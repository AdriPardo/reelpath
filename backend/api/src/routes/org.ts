import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  buildOrgInviteEmail,
  loadConfig,
  PRODUCT_DEFAULTS,
  sendEmail,
} from '@autotube/config';
import {
  deleteOrgElevenLabsApiKey,
  getOrgPipelineSettings,
  getPlatformSecretsStatus,
  prisma,
  resolveOrgElevenLabsApiKey,
  resolvePlatformApiKey,
  upsertOrgElevenLabsApiKey,
} from '@autotube/database';
import { ELEVENLABS_TTS_VOICES, getTtsVoicesForProvider } from '@autotube/shared';
import type { MemberRole } from '../lib/auth.js';
import { deleteChannelWithCleanup } from '../lib/channel-deletion.js';
import { authMiddleware, orgScope, requireAdmin, requireAuth } from '../middleware/auth.js';
import { handleTtsPreview } from './tts-preview.js';

export const orgRouter = Router();

orgRouter.use(authMiddleware, requireAuth);

type ElevenLabsVoiceDto = {
  id: string;
  label: string;
  locale: string;
  gender?: 'female' | 'male' | 'neutral';
  description?: string;
  accent?: string;
  previewUrl?: string | null;
};

type VoiceCatalogCache = { at: number; keyHash: string; voices: ElevenLabsVoiceDto[] };
let elevenLabsCatalogCache: VoiceCatalogCache | null = null;
const CATALOG_CACHE_MS = 60 * 60 * 1000;

async function resolveElevenLabsKey(orgId: string): Promise<string | null> {
  const orgKey = await resolveOrgElevenLabsApiKey(orgId);
  if (orgKey) return orgKey;
  const platformKey = await resolvePlatformApiKey('elevenlabs');
  if (platformKey) return platformKey;
  return loadConfig().ELEVENLABS_API_KEY?.trim() || null;
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

function mapElevenLabsGender(raw?: string): 'female' | 'male' | 'neutral' | undefined {
  const g = (raw ?? '').trim().toLowerCase();
  if (g === 'female' || g === 'male') return g;
  if (g === 'neutral' || g === 'non-binary' || g === 'nonbinary') return 'neutral';
  return undefined;
}

/** Full account catalog from ElevenLabs (premade + cloned + shared for that API key). */
async function loadElevenLabsVoiceCatalog(apiKey: string): Promise<ElevenLabsVoiceDto[]> {
  const keyHash = hashApiKey(apiKey);
  if (
    elevenLabsCatalogCache &&
    elevenLabsCatalogCache.keyHash === keyHash &&
    Date.now() - elevenLabsCatalogCache.at < CATALOG_CACHE_MS
  ) {
    return elevenLabsCatalogCache.voices;
  }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs voices failed (${res.status})`);
  }

  const data = (await res.json()) as {
    voices?: Array<{
      voice_id?: string;
      name?: string;
      preview_url?: string | null;
      description?: string | null;
      category?: string | null;
      labels?: Record<string, string | undefined>;
    }>;
  };

  const voices: ElevenLabsVoiceDto[] = [];
  for (const voice of data.voices ?? []) {
    const id = voice.voice_id?.trim();
    const name = voice.name?.trim();
    if (!id || !name) continue;
    const labels = voice.labels ?? {};
    const accent =
      labels.accent?.trim() ||
      labels.language?.trim() ||
      labels.use_case?.trim() ||
      labels.descriptive?.trim() ||
      (voice.category?.trim() ? voice.category.trim() : 'ElevenLabs');
    const description =
      voice.description?.trim() ||
      labels.description?.trim() ||
      labels.use_case?.trim() ||
      undefined;
    voices.push({
      id,
      label: name,
      locale: labels.language?.trim() || 'multilingual',
      gender: mapElevenLabsGender(labels.gender),
      accent,
      description,
      previewUrl: voice.preview_url ?? null,
    });
  }

  voices.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  elevenLabsCatalogCache = { at: Date.now(), keyHash, voices };
  return voices;
}

function clearElevenLabsCatalogCache(): void {
  elevenLabsCatalogCache = null;
}

/** Full ElevenLabs catalog when a key is available; curated fallback otherwise. */
orgRouter.get('/tts/voices', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  const providerRaw = String(req.query.provider ?? 'elevenlabs');
  const provider =
    providerRaw === 'edge' || providerRaw === 'openai' || providerRaw === 'elevenlabs'
      ? providerRaw
      : 'elevenlabs';

  if (provider === 'elevenlabs') {
    try {
      const apiKey = await resolveElevenLabsKey(orgId);
      if (apiKey) {
        const remote = await loadElevenLabsVoiceCatalog(apiKey);
        if (remote.length > 0) {
          return res.json({
            provider,
            source: 'elevenlabs',
            previewsAvailable: remote.some((v) => Boolean(v.previewUrl)),
            voices: remote,
          });
        }
      }
    } catch (err) {
      console.warn('[org/tts/voices] ElevenLabs catalog failed', err);
    }

    return res.json({
      provider,
      source: 'curated',
      previewsAvailable: false,
      voices: ELEVENLABS_TTS_VOICES.map((v) => ({
        ...v,
        previewUrl: v.previewUrl ?? null,
      })),
    });
  }

  const curated = getTtsVoicesForProvider(provider);
  res.json({
    provider,
    source: 'curated',
    previewsAvailable: false,
    voices: curated.map((v) => ({
      ...v,
      previewUrl: v.previewUrl ?? null,
    })),
  });
});

/** Preview TTS vivo (Edge / OpenAI / ElevenLabs) — audio/mpeg. */
orgRouter.post('/tts/preview', handleTtsPreview);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const optionalVoiceId = z.union([z.string().min(2).max(120), z.null()]).optional();
const optionalElevenLabsKey = z.union([z.string().min(8).max(500), z.literal(''), z.null()]).optional();

/** OpenAI/DeepSeek = solo plataforma. ElevenLabs BYOK org permitido. */
const ORG_FORBIDDEN_AI_KEY_FIELDS = ['openaiApiKey', 'deepseekApiKey'] as const;

const orgSettingsPatchSchema = z
  .object({
    llmProvider: z.enum(['auto', 'deepseek', 'openai']).optional(),
    ttsProvider: z.enum(['auto', 'edge', 'elevenlabs', 'openai']).optional(),
    generateAiImages: z.boolean().optional(),
    maxScenesLong: z.union([z.number().int().min(4).max(40), z.null()]).optional(),
    maxAiImagesPerVideo: z.union([z.number().int().min(0).max(100), z.null()]).optional(),
    openaiImageQuality: z
      .union([z.enum(['low', 'medium', 'high', 'auto']), z.null()])
      .optional(),
    edgeTtsVoice: optionalVoiceId,
    elevenLabsVoiceId: optionalVoiceId,
    openaiTtsVoice: optionalVoiceId,
    openaiApiKey: z.unknown().optional(),
    deepseekApiKey: z.unknown().optional(),
    elevenLabsApiKey: optionalElevenLabsKey,
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'No hay campos para actualizar',
  });

const purgeSchema = z.object({
  confirmation: z.string().min(3),
});

function serializeMember(member: {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; email: string; name: string | null };
}) {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    user: {
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
    },
  };
}

orgRouter.get('/members', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  const [members, invites] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.organizationInvite.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ]);

  res.json({
    members: members.map(serializeMember),
    pendingInvites: invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  });
});

orgRouter.post('/invites', requireAdmin, async (req, res) => {
  const orgId = orgScope(req)!;
  const body = inviteSchema.parse(req.body);
  const email = body.email.toLowerCase();

  const organization = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!organization) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }

  const existingMember = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, user: { email } },
    include: { user: { select: { email: true } } },
  });
  if (existingMember) {
    return res.status(409).json({ error: 'Ese usuario ya pertenece a la organización' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: existingUser.id,
        role: body.role,
      },
    });

    return res.status(201).json({
      status: 'added',
      message: `${email} se ha añadido a la organización`,
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: orgId, email } },
    create: {
      organizationId: orgId,
      email,
      role: body.role,
      token,
      invitedById: req.auth!.userId,
      expiresAt,
    },
    update: {
      role: body.role,
      token,
      invitedById: req.auth!.userId,
      expiresAt,
      acceptedAt: null,
    },
  });

  const config = loadConfig();
  const inviter = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { name: true, locale: true },
  });
  const locale = inviter?.locale === 'en' ? 'en' : 'es';
  const inviteUrl = `${config.FRONTEND_URL}/${locale}/invite/${token}`;

  const mail = buildOrgInviteEmail({
    organizationName: organization.name,
    inviteUrl,
    inviterName: inviter?.name ?? null,
    locale,
  });

  await sendEmail({
    to: email,
    templateId: 'org_invite',
    ...mail,
  });

  res.status(201).json({
    status: 'invited',
    message: `Invitación enviada a ${email}`,
    inviteUrl:
      config.NODE_ENV === 'development' || process.env.E2E_TESTS === 'true' ? inviteUrl : undefined,
  });
});

const acceptInviteSchema = z.object({
  token: z.string().min(16),
});

orgRouter.post('/invites/accept', async (req, res) => {
  const orgId = orgScope(req)!;
  const body = acceptInviteSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: body.token },
    include: { organization: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invitación no válida o expirada' });
  }

  if (invite.email !== user.email.toLowerCase()) {
    return res.status(403).json({ error: 'La invitación es para otro email' });
  }

  const existingMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
    },
  });

  if (existingMembership && existingMembership.organizationId !== orgId) {
    return res.status(409).json({
      error: 'Ya perteneces a otra organización. Cierra sesión y vuelve a entrar tras aceptar.',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
      },
      create: {
        organizationId: invite.organizationId,
        userId: user.id,
        role: invite.role as MemberRole,
      },
      update: { role: invite.role },
    });

    await tx.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  res.json({
    message: `Te has unido a «${invite.organization.name}»`,
    organization: {
      id: invite.organization.id,
      name: invite.organization.name,
    },
  });
});

orgRouter.get('/settings', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  const settings = await getOrgPipelineSettings(orgId);
  if (!settings) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }

  const platformStatus = await getPlatformSecretsStatus();
  const config = loadConfig();

  res.json({
    ...settings,
    /** Compat con UI antigua que solo miraba OpenAI BYOK. */
    hasOpenaiKey: settings.hasOpenaiKey,
    platformKeys: {
      openai: platformStatus.hasOpenaiKey || !!config.OPENAI_API_KEY?.trim(),
      deepseek: platformStatus.hasDeepseekKey || !!config.DEEPSEEK_API_KEY?.trim(),
      elevenlabs: platformStatus.hasElevenLabsKey || !!config.ELEVENLABS_API_KEY?.trim(),
    },
    platformDefaults: {
      llmProvider: PRODUCT_DEFAULTS.llmProvider,
      ttsProvider: PRODUCT_DEFAULTS.ttsProvider,
      generateAiImages: PRODUCT_DEFAULTS.generateAiImages,
      maxScenesLong: PRODUCT_DEFAULTS.maxScenesLong,
      minScenesLong: PRODUCT_DEFAULTS.minScenesLong,
      maxScenesShort: PRODUCT_DEFAULTS.maxScenesShort,
      maxAiImagesPerVideo: PRODUCT_DEFAULTS.maxAiImagesPerVideo,
      openaiImageQuality: PRODUCT_DEFAULTS.openaiImageQuality,
      edgeTtsVoice: PRODUCT_DEFAULTS.edgeTtsVoice,
      elevenLabsVoiceId: PRODUCT_DEFAULTS.elevenLabsVoiceId,
      openaiTtsVoice: PRODUCT_DEFAULTS.openaiTtsVoice,
    },
  });
});

orgRouter.patch('/settings', requireAdmin, async (req, res) => {
  const orgId = orgScope(req)!;
  const raw = req.body as Record<string, unknown> | null;
  if (raw && typeof raw === 'object') {
    for (const field of ORG_FORBIDDEN_AI_KEY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(raw, field)) {
        return res.status(403).json({
          error:
            'Las claves de IA las gestiona solo un administrador de plataforma (Admin → Infra)',
          hint: 'Usa /admin?tab=infra o PATCH /api/platform/secrets',
        });
      }
    }
  }

  const body = orgSettingsPatchSchema.parse(req.body);

  if (body.openaiApiKey !== undefined || body.deepseekApiKey !== undefined) {
    return res.status(400).json({
      error:
        'Las claves OpenAI/DeepSeek las gestiona la plataforma (Admin → Secretos). ' +
        'La organización solo puede aportar clave ElevenLabs (BYOK) y preferencias.',
    });
  }

  if (body.elevenLabsApiKey !== undefined) {
    const rawKey = body.elevenLabsApiKey;
    if (rawKey === null || rawKey === '') {
      await deleteOrgElevenLabsApiKey(orgId);
      clearElevenLabsCatalogCache();
    } else if (typeof rawKey === 'string' && rawKey.trim()) {
      await upsertOrgElevenLabsApiKey(orgId, rawKey.trim());
      clearElevenLabsCatalogCache();
    } else {
      return res.status(400).json({ error: 'elevenLabsApiKey inválida' });
    }
  }

  const data: {
    llmProvider?: string;
    ttsProvider?: string;
    generateAiImages?: boolean;
    maxScenesLong?: number | null;
    maxAiImagesPerVideo?: number | null;
    openaiImageQuality?: string | null;
    edgeTtsVoice?: string | null;
    elevenLabsVoiceId?: string | null;
    openaiTtsVoice?: string | null;
  } = {};

  if (body.llmProvider !== undefined) data.llmProvider = body.llmProvider;
  if (body.ttsProvider !== undefined) data.ttsProvider = body.ttsProvider;
  if (body.generateAiImages !== undefined) data.generateAiImages = body.generateAiImages;
  if (body.maxScenesLong !== undefined) data.maxScenesLong = body.maxScenesLong;
  if (body.maxAiImagesPerVideo !== undefined) data.maxAiImagesPerVideo = body.maxAiImagesPerVideo;
  if (body.openaiImageQuality !== undefined) data.openaiImageQuality = body.openaiImageQuality;
  if (body.edgeTtsVoice !== undefined) data.edgeTtsVoice = body.edgeTtsVoice;
  if (body.elevenLabsVoiceId !== undefined) data.elevenLabsVoiceId = body.elevenLabsVoiceId;
  if (body.openaiTtsVoice !== undefined) data.openaiTtsVoice = body.openaiTtsVoice;

  if (Object.keys(data).length > 0) {
    await prisma.organization.update({
      where: { id: orgId },
      data,
    });
  }

  const settings = await getOrgPipelineSettings(orgId);
  res.json({
    ...settings,
    message: 'Ajustes de generación guardados',
  });
});

orgRouter.delete('/invites/:id', requireAdmin, async (req, res) => {
  const orgId = orgScope(req)!;
  const inviteId = String(req.params.id);
  const invite = await prisma.organizationInvite.findFirst({
    where: { id: inviteId, organizationId: orgId, acceptedAt: null },
  });
  if (!invite) {
    return res.status(404).json({ error: 'Invitación no encontrada' });
  }
  await prisma.organizationInvite.delete({ where: { id: invite.id } });
  res.json({ message: 'Invitación cancelada' });
});

/**
 * PURGE: elimina todo el contenido de la org (canales + pipelines + vídeos + credenciales por canal).
 * No elimina la organización ni miembros.
 */
orgRouter.post('/purge', requireAdmin, async (req, res) => {
  const orgId = orgScope(req)!;
  const body = purgeSchema.parse(req.body);
  if (body.confirmation !== 'DELETE_ORG_CONTENT') {
    return res.status(400).json({
      error: 'Confirmación inválida',
      hint: 'Envía { "confirmation": "DELETE_ORG_CONTENT" } para confirmar el borrado',
    });
  }

  const channels = await prisma.channel.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  const deleted: Array<{ id: string; name: string }> = [];
  for (const ch of channels) {
    await deleteChannelWithCleanup(ch.id);
    deleted.push(ch);
  }

  res.json({
    ok: true,
    deletedChannels: deleted.length,
    channels: deleted,
  });
});

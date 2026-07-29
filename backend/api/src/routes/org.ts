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
  deleteOrgDeepseekApiKey,
  deleteOrgElevenLabsApiKey,
  deleteOrgOpenAiApiKey,
  getOrgPipelineSettings,
  prisma,
  upsertOrgDeepseekApiKey,
  upsertOrgElevenLabsApiKey,
  upsertOrgOpenAiApiKey,
} from '@autotube/database';
import type { MemberRole } from '../lib/auth.js';
import { deleteChannelWithCleanup } from '../lib/channel-deletion.js';
import { authMiddleware, orgScope, requireAdmin, requireAuth } from '../middleware/auth.js';

export const orgRouter = Router();

orgRouter.use(authMiddleware, requireAuth);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const optionalApiKey = z.union([z.string().min(10), z.null()]).optional();
const optionalVoiceId = z.union([z.string().min(2).max(120), z.null()]).optional();

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
    openaiApiKey: optionalApiKey,
    deepseekApiKey: optionalApiKey,
    elevenLabsApiKey: optionalApiKey,
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

  res.json({
    ...settings,
    /** Compat con UI antigua que solo miraba OpenAI BYOK. */
    hasOpenaiKey: settings.hasOpenaiKey,
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
  const body = orgSettingsPatchSchema.parse(req.body);

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

  if (body.openaiApiKey !== undefined) {
    if (body.openaiApiKey === null) await deleteOrgOpenAiApiKey(orgId);
    else await upsertOrgOpenAiApiKey(orgId, body.openaiApiKey);
  }
  if (body.deepseekApiKey !== undefined) {
    if (body.deepseekApiKey === null) await deleteOrgDeepseekApiKey(orgId);
    else await upsertOrgDeepseekApiKey(orgId, body.deepseekApiKey);
  }
  if (body.elevenLabsApiKey !== undefined) {
    if (body.elevenLabsApiKey === null) await deleteOrgElevenLabsApiKey(orgId);
    else await upsertOrgElevenLabsApiKey(orgId, body.elevenLabsApiKey);
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

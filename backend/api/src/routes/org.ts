import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  buildOrgInviteEmail,
  loadConfig,
  sendEmail,
} from '@autotube/config';
import {
  deleteOrgOpenAiApiKey,
  hasOrgOpenAiApiKey,
  prisma,
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

const openAiKeySchema = z.object({
  openaiApiKey: z.string().min(10).nullable(),
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

  const hasOpenaiKey = await hasOrgOpenAiApiKey(orgId);
  res.json({ hasOpenaiKey });
});

orgRouter.patch('/settings', requireAdmin, async (req, res) => {
  const orgId = orgScope(req)!;
  const body = openAiKeySchema.parse(req.body);

  if (body.openaiApiKey === null) {
    await deleteOrgOpenAiApiKey(orgId);
    return res.json({ hasOpenaiKey: false, message: 'Clave OpenAI eliminada' });
  }

  await upsertOrgOpenAiApiKey(orgId, body.openaiApiKey);
  res.json({ hasOpenaiKey: true, message: 'Clave OpenAI guardada de forma segura' });
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

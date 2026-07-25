import { decryptCredentialPayload, encryptCredentialPayload, loadConfig } from '@autotube/config';
import { prisma } from './index.js';

const OPENAI_PROVIDER = 'openai';

export async function resolveOrgOpenAiApiKey(organizationId: string): Promise<string | null> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider: OPENAI_PROVIDER, channelId: null },
  });

  if (cred) {
    const data = decryptCredentialPayload(cred.data);
    const key = data?.apiKey;
    if (typeof key === 'string' && key.trim()) {
      return key.trim();
    }
  }

  const config = loadConfig();
  return config.OPENAI_API_KEY?.trim() ?? null;
}

export async function upsertOrgOpenAiApiKey(
  organizationId: string,
  apiKey: string,
): Promise<void> {
  const existing = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider: OPENAI_PROVIDER, channelId: null },
  });

  const data = encryptCredentialPayload({ apiKey: apiKey.trim() }) as object;

  if (existing) {
    await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: { data },
    });
    return;
  }

  await prisma.integrationCredential.create({
    data: {
      organizationId,
      channelId: null,
      provider: OPENAI_PROVIDER,
      data,
    },
  });
}

export async function deleteOrgOpenAiApiKey(organizationId: string): Promise<void> {
  await prisma.integrationCredential.deleteMany({
    where: { organizationId, provider: OPENAI_PROVIDER, channelId: null },
  });
}

export async function hasOrgOpenAiApiKey(organizationId: string): Promise<boolean> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider: OPENAI_PROVIDER, channelId: null },
    select: { id: true },
  });
  return Boolean(cred);
}

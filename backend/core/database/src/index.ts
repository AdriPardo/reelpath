import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from '@prisma/client';
export {
  deleteOrgDeepseekApiKey,
  deleteOrgElevenLabsApiKey,
  deleteOrgOpenAiApiKey,
  getOrgPipelineSettings,
  hasOrgDeepseekApiKey,
  hasOrgElevenLabsApiKey,
  hasOrgOpenAiApiKey,
  loadOrgPipelineOverrides,
  resolveOrgDeepseekApiKey,
  resolveOrgElevenLabsApiKey,
  resolveOrgOpenAiApiKey,
  upsertOrgDeepseekApiKey,
  upsertOrgElevenLabsApiKey,
  upsertOrgOpenAiApiKey,
  type OrgPipelineSettings,
} from './org-settings.js';
export {
  assertPlatformSecretKey,
  deletePlatformSecret,
  getPlatformSecretsStatus,
  importPlatformSecretsFromEnvIfEmpty,
  loadPlatformSecretsOverrides,
  resolvePlatformApiKey,
  resolvePlatformYouTubeOAuthApp,
  upsertPlatformApiKey,
  upsertPlatformYouTubeOAuthApp,
  PLATFORM_SECRET_KEYS,
  type PlatformSecretKey,
  type PlatformSecretsStatus,
} from './platform-secrets.js';

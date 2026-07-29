import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  type OrgImageQuality,
  type OrgLlmProvider,
  type OrgPipelineOverrides,
  type OrgTtsProvider,
} from '@autotube/config';
import { prisma } from './index.js';

const BYOK_PROVIDERS = ['openai', 'deepseek', 'elevenlabs'] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

const LLM_PROVIDERS = new Set<OrgLlmProvider>(['auto', 'deepseek', 'openai']);
const TTS_PROVIDERS = new Set<OrgTtsProvider>(['auto', 'edge', 'elevenlabs', 'openai']);
const IMAGE_QUALITIES = new Set<OrgImageQuality>(['low', 'medium', 'high', 'auto']);

async function readByokApiKey(
  organizationId: string,
  provider: ByokProvider,
): Promise<string | null> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider, channelId: null },
  });
  if (!cred) return null;
  const data = decryptCredentialPayload(cred.data);
  const key = data?.apiKey;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

async function hasByokApiKey(organizationId: string, provider: ByokProvider): Promise<boolean> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider, channelId: null },
    select: { id: true },
  });
  return Boolean(cred);
}

async function upsertByokApiKey(
  organizationId: string,
  provider: ByokProvider,
  apiKey: string,
): Promise<void> {
  const existing = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider, channelId: null },
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
      provider,
      data,
    },
  });
}

async function deleteByokApiKey(organizationId: string, provider: ByokProvider): Promise<void> {
  await prisma.integrationCredential.deleteMany({
    where: { organizationId, provider, channelId: null },
  });
}

/** BYOK only — does not fall back to platform .env (that stays in resolveLlmConnection). */
export async function resolveOrgOpenAiApiKey(organizationId: string): Promise<string | null> {
  return readByokApiKey(organizationId, 'openai');
}

export async function upsertOrgOpenAiApiKey(organizationId: string, apiKey: string): Promise<void> {
  return upsertByokApiKey(organizationId, 'openai', apiKey);
}

export async function deleteOrgOpenAiApiKey(organizationId: string): Promise<void> {
  return deleteByokApiKey(organizationId, 'openai');
}

export async function hasOrgOpenAiApiKey(organizationId: string): Promise<boolean> {
  return hasByokApiKey(organizationId, 'openai');
}

export async function resolveOrgDeepseekApiKey(organizationId: string): Promise<string | null> {
  return readByokApiKey(organizationId, 'deepseek');
}

export async function upsertOrgDeepseekApiKey(organizationId: string, apiKey: string): Promise<void> {
  return upsertByokApiKey(organizationId, 'deepseek', apiKey);
}

export async function deleteOrgDeepseekApiKey(organizationId: string): Promise<void> {
  return deleteByokApiKey(organizationId, 'deepseek');
}

export async function hasOrgDeepseekApiKey(organizationId: string): Promise<boolean> {
  return hasByokApiKey(organizationId, 'deepseek');
}

export async function resolveOrgElevenLabsApiKey(organizationId: string): Promise<string | null> {
  return readByokApiKey(organizationId, 'elevenlabs');
}

export async function upsertOrgElevenLabsApiKey(
  organizationId: string,
  apiKey: string,
): Promise<void> {
  return upsertByokApiKey(organizationId, 'elevenlabs', apiKey);
}

export async function deleteOrgElevenLabsApiKey(organizationId: string): Promise<void> {
  return deleteByokApiKey(organizationId, 'elevenlabs');
}

export async function hasOrgElevenLabsApiKey(organizationId: string): Promise<boolean> {
  return hasByokApiKey(organizationId, 'elevenlabs');
}

export type OrgPipelineSettings = {
  llmProvider: OrgLlmProvider;
  ttsProvider: OrgTtsProvider;
  generateAiImages: boolean;
  maxScenesLong: number | null;
  maxAiImagesPerVideo: number | null;
  openaiImageQuality: OrgImageQuality | null;
  edgeTtsVoice: string | null;
  elevenLabsVoiceId: string | null;
  openaiTtsVoice: string | null;
  hasOpenaiKey: boolean;
  hasDeepseekKey: boolean;
  hasElevenLabsKey: boolean;
};

function parseLlmProvider(value: string | null | undefined): OrgLlmProvider {
  return LLM_PROVIDERS.has(value as OrgLlmProvider) ? (value as OrgLlmProvider) : 'auto';
}

function parseTtsProvider(value: string | null | undefined): OrgTtsProvider {
  return TTS_PROVIDERS.has(value as OrgTtsProvider) ? (value as OrgTtsProvider) : 'auto';
}

function parseImageQuality(value: string | null | undefined): OrgImageQuality | null {
  if (!value) return null;
  return IMAGE_QUALITIES.has(value as OrgImageQuality) ? (value as OrgImageQuality) : null;
}

function parseOptionalVoice(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

export async function getOrgPipelineSettings(
  organizationId: string,
): Promise<OrgPipelineSettings | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      llmProvider: true,
      ttsProvider: true,
      generateAiImages: true,
      maxScenesLong: true,
      maxAiImagesPerVideo: true,
      openaiImageQuality: true,
      edgeTtsVoice: true,
      elevenLabsVoiceId: true,
      openaiTtsVoice: true,
    },
  });
  if (!org) return null;

  const [hasOpenaiKey, hasDeepseekKey, hasElevenLabsKey] = await Promise.all([
    hasOrgOpenAiApiKey(organizationId),
    hasOrgDeepseekApiKey(organizationId),
    hasOrgElevenLabsApiKey(organizationId),
  ]);

  return {
    llmProvider: parseLlmProvider(org.llmProvider),
    ttsProvider: parseTtsProvider(org.ttsProvider),
    generateAiImages: org.generateAiImages,
    maxScenesLong: org.maxScenesLong,
    maxAiImagesPerVideo: org.maxAiImagesPerVideo,
    openaiImageQuality: parseImageQuality(org.openaiImageQuality),
    edgeTtsVoice: parseOptionalVoice(org.edgeTtsVoice),
    elevenLabsVoiceId: parseOptionalVoice(org.elevenLabsVoiceId),
    openaiTtsVoice: parseOptionalVoice(org.openaiTtsVoice),
    hasOpenaiKey,
    hasDeepseekKey,
    hasElevenLabsKey,
  };
}

/** Load prefs + BYOK keys for the worker pipeline runtime. */
export async function loadOrgPipelineOverrides(
  organizationId: string,
): Promise<OrgPipelineOverrides | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      llmProvider: true,
      ttsProvider: true,
      generateAiImages: true,
      maxScenesLong: true,
      maxAiImagesPerVideo: true,
      openaiImageQuality: true,
      edgeTtsVoice: true,
      elevenLabsVoiceId: true,
      openaiTtsVoice: true,
    },
  });
  if (!org) return null;

  const [openAiApiKey, deepseekApiKey, elevenLabsApiKey] = await Promise.all([
    resolveOrgOpenAiApiKey(organizationId),
    resolveOrgDeepseekApiKey(organizationId),
    resolveOrgElevenLabsApiKey(organizationId),
  ]);

  return {
    llmProvider: parseLlmProvider(org.llmProvider),
    ttsProvider: parseTtsProvider(org.ttsProvider),
    generateAiImages: org.generateAiImages,
    maxScenesLong: org.maxScenesLong,
    maxAiImagesPerVideo: org.maxAiImagesPerVideo,
    openaiImageQuality: parseImageQuality(org.openaiImageQuality),
    edgeTtsVoice: parseOptionalVoice(org.edgeTtsVoice),
    elevenLabsVoiceId: parseOptionalVoice(org.elevenLabsVoiceId),
    openaiTtsVoice: parseOptionalVoice(org.openaiTtsVoice),
    openAiApiKey,
    deepseekApiKey,
    elevenLabsApiKey,
  };
}

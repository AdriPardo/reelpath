/**
 * Sync cache of platform secrets (API process / worker job).
 * Loaded from PlatformSecret in BD; used by resolveLlmConnection and YouTube OAuth.
 */
export type PlatformSecretsOverrides = {
  youtubeClientId?: string | null;
  youtubeClientSecret?: string | null;
  openAiApiKey?: string | null;
  deepseekApiKey?: string | null;
  elevenLabsApiKey?: string | null;
  falApiKey?: string | null;
  pexelsApiKey?: string | null;
  pixabayApiKey?: string | null;
  coverrApiKey?: string | null;
  uploadPostApiKey?: string | null;
  uploadPostUsername?: string | null;
  uploadPostEnabled?: boolean | null;
};

let platformSecrets: PlatformSecretsOverrides | null = null;

export function setPlatformSecretsOverrides(secrets: PlatformSecretsOverrides | null): void {
  platformSecrets = secrets;
}

export function clearPlatformSecretsOverrides(): void {
  platformSecrets = null;
}

export function getPlatformSecretsOverrides(): PlatformSecretsOverrides | null {
  return platformSecrets;
}

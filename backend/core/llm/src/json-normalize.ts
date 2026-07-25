type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstArray(obj: JsonObject): unknown[] | undefined {
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return undefined;
}

function pickVariant(obj: JsonObject, keys: string[]): JsonObject | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (isObject(value)) return value;
  }
  return undefined;
}

function scenesFromObject(obj: JsonObject): JsonObject[] | undefined {
  const candidates = [obj.scenes, obj.escenas, obj.scene, obj.sequences];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.filter(isObject);
    }
  }
  return undefined;
}

function findSharedScenes(raw: JsonObject): JsonObject[] | undefined {
  const direct = scenesFromObject(raw);
  if (direct?.length) return direct;

  for (const key of ['guion', 'script', 'guionCompleto', 'content']) {
    const nested = raw[key];
    if (isObject(nested)) {
      const nestedScenes = scenesFromObject(nested);
      if (nestedScenes?.length) return nestedScenes;
    }
  }

  const variantA = pickVariant(raw, ['variantA', 'variant_a', 'variant_a_hook']);
  if (variantA) {
    const fromA = scenesFromObject(variantA);
    if (fromA?.length) return fromA;
  }

  const fallback = firstArray(raw);
  if (fallback?.length && isObject(fallback[0]) && ('narration' in fallback[0] || 'text' in fallback[0])) {
    return fallback.filter(isObject);
  }

  return undefined;
}

function pickHook(raw: JsonObject, variant: JsonObject | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key] ?? variant?.[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return '';
}

export function extractIdeasArray(raw: unknown): JsonObject[] {
  if (Array.isArray(raw)) return raw.filter(isObject);

  if (!isObject(raw)) {
    throw new Error('Invalid LLM response: expected JSON object');
  }

  const candidates = [raw.ideas, raw.videoIdeas, raw.video_ideas, firstArray(raw)];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const items = candidate.filter(isObject);
      if (items.length > 0) return items;
    }
  }

  throw new Error('Invalid LLM response: no ideas array found');
}

export function extractScriptResponse(raw: unknown): {
  title: string;
  description: string;
  tags: string[];
  variantA: JsonObject;
  variantB: JsonObject;
} {
  if (!isObject(raw)) {
    throw new Error('Invalid LLM response: expected JSON object');
  }

  const title = String(raw.title ?? raw.videoTitle ?? raw.titulo ?? 'Sin título');
  const description = String(raw.description ?? raw.videoDescription ?? raw.descripcion ?? '');
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];

  const sharedScenes = findSharedScenes(raw);
  if (sharedScenes?.length) {
    const hookA = pickHook(raw, undefined, ['hookA', 'hook_a', 'hook', 'ganchoA', 'gancho_a']);
    const hookB = pickHook(raw, undefined, ['hookB', 'hook_b', 'ganchoB', 'gancho_b']) || hookA;
    return {
      title,
      description,
      tags,
      variantA: { hook: hookA, scenes: sharedScenes },
      variantB: { hook: hookB, scenes: sharedScenes },
    };
  }

  const variantA = pickVariant(raw, ['variantA', 'variant_a', 'variant_a_hook']);
  const variantB = pickVariant(raw, ['variantB', 'variant_b', 'variant_b_hook']);

  if (variantA && variantB) {
    return { title, description, tags, variantA, variantB };
  }

  if (variantA) {
    const hookA = pickHook(raw, variantA, ['hook', 'hookA', 'hook_a']);
    const hookB = pickHook(raw, variantA, ['hookB', 'hook_b']) || hookA;
    return {
      title,
      description,
      tags,
      variantA,
      variantB: { hook: hookB, scenes: variantA.scenes ?? variantA.scene ?? [] },
    };
  }

  const keys = Object.keys(raw).join(', ');
  throw new Error(`Invalid LLM response: no scenes found (keys: ${keys})`);
}

export function extractScenes(variant: JsonObject): JsonObject[] {
  const scenes = variant.scenes ?? variant.escenas ?? variant.scene ?? variant.script;
  if (!Array.isArray(scenes)) {
    throw new Error('Invalid LLM response: variant missing scenes array');
  }
  return scenes.filter(isObject);
}

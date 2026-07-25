export type VisualOrigin = 'stock' | 'ai' | 'placeholder';

export interface SceneVisualOrigin {
  sceneIndex: number;
  origin: VisualOrigin;
}

export interface VisualOriginSummary {
  stock: number;
  ai: number;
  placeholder: number;
  total: number;
  hasPlaceholders: boolean;
  scenes: SceneVisualOrigin[];
}

export interface VisualOriginAsset {
  sceneIndex: number;
  type: string;
  metadata?: Record<string, unknown> | null;
}

export function computeVisualOriginSummary(
  assets: VisualOriginAsset[],
): VisualOriginSummary | null {
  const visualAssets = assets.filter(
    (a) => (a.type === 'image' || a.type === 'video') && a.sceneIndex >= 0,
  );
  if (visualAssets.length === 0) return null;

  const scenes: SceneVisualOrigin[] = [];
  let stock = 0;
  let ai = 0;
  let placeholder = 0;

  for (const asset of visualAssets) {
    const raw = asset.metadata?.visualOrigin;
    let origin: VisualOrigin;
    if (raw === 'stock' || raw === 'ai' || raw === 'placeholder') {
      origin = raw;
    } else if (asset.type === 'video') {
      origin = 'stock';
    } else if (asset.metadata?.preferredVisualSource === 'stock') {
      origin = 'stock';
    } else {
      origin = 'ai';
    }
    scenes.push({ sceneIndex: asset.sceneIndex, origin });
    if (origin === 'stock') stock++;
    else if (origin === 'ai') ai++;
    else placeholder++;
  }

  scenes.sort((a, b) => a.sceneIndex - b.sceneIndex);

  return {
    stock,
    ai,
    placeholder,
    total: visualAssets.length,
    hasPlaceholders: placeholder > 0,
    scenes,
  };
}

export function visualOriginLabel(origin: VisualOrigin): string {
  switch (origin) {
    case 'stock':
      return 'Stock';
    case 'ai':
      return 'IA';
    case 'placeholder':
      return 'Placeholder';
  }
}

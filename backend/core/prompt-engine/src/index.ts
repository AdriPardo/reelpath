import { prisma } from '@autotube/database';
import type { PromptType } from '@autotube/shared';

export interface RenderPromptOptions {
  channelId: string;
  type: PromptType;
  variables: Record<string, string | number>;
  abVariant?: 'A' | 'B';
}

export interface RenderedPrompt {
  promptVersionId: string;
  variantId?: string;
  variantKey?: string;
  content: string;
  version: string;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export class PromptEngine {
  async render(options: RenderPromptOptions): Promise<RenderedPrompt> {
    const binding = await prisma.promptBinding.findUnique({
      where: {
        channelId_promptType: {
          channelId: options.channelId,
          promptType: options.type,
        },
      },
      include: {
        promptVersion: {
          include: { variants: true },
        },
      },
    });

    let promptVersion = binding?.promptVersion ?? undefined;

    if (!promptVersion) {
      promptVersion =
        (await prisma.promptVersion.findFirst({
          where: { type: options.type, isActive: true },
          include: { variants: true },
          orderBy: { createdAt: 'desc' },
        })) ?? undefined;
    }

    if (!promptVersion) {
      throw new Error(`No prompt found for type: ${options.type}`);
    }

    let template = promptVersion.template;
    let variantId: string | undefined;
    let variantKey: string | undefined;

    if (options.abVariant && promptVersion.variants.length > 0) {
      const variant =
        promptVersion.variants.find((v) => v.variantKey === options.abVariant) ??
        this.selectWeightedVariant(promptVersion.variants);

      variantId = variant.id;
      variantKey = variant.variantKey;
      if (variant.templateOverride) {
        template = variant.templateOverride;
      }
    }

    return {
      promptVersionId: promptVersion.id,
      variantId,
      variantKey,
      content: interpolate(template, options.variables),
      version: promptVersion.version,
    };
  }

  selectWeightedVariant(
    variants: Array<{ id: string; variantKey: string; weight: number; templateOverride?: string | null }>,
  ): { id: string; variantKey: string; weight: number; templateOverride?: string | null } {
    const total = variants.reduce((s, v) => s + v.weight, 0);
    let r = Math.random() * total;
    for (const v of variants) {
      r -= v.weight;
      if (r <= 0) return v;
    }
    return variants[0];
  }

  async recordAbResult(params: {
    promptVersionId: string;
    variantId: string;
    pipelineRunId?: string;
    metric: string;
    value: number;
  }): Promise<void> {
    await prisma.promptAbResult.create({ data: params });

    const results = await prisma.promptAbResult.groupBy({
      by: ['variantId'],
      where: { promptVersionId: params.promptVersionId, metric: params.metric },
      _avg: { value: true },
    });

    const totalAvg =
      results.reduce((s, r) => s + (r._avg.value ?? 0), 0) / Math.max(results.length, 1);

    for (const r of results) {
      const avg = r._avg.value ?? 0;
      const weight = totalAvg > 0 ? avg / totalAvg : 0.5;
      await prisma.promptVariant.update({
        where: { id: r.variantId },
        data: { weight: Math.max(0.1, Math.min(0.9, weight)) },
      });
    }
  }

  async createVersion(params: {
    type: PromptType;
    version: string;
    name: string;
    template: string;
    variables: string[];
  }) {
    return prisma.promptVersion.create({ data: params });
  }
}

export const promptEngine = new PromptEngine();

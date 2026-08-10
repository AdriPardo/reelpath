import { describe, expect, it } from 'vitest';
import {
  getIdeaPipelineSystemHints,
  getNarrationQualityRules,
  getScriptBodyPipelineHints,
  getScriptMetadataRules,
  getTeaserPipelineHints,
} from './prompt-pipeline.js';
import type { ChannelConfig } from './types.js';

const baseConfig = {
  niche: 'historia y curiosidades',
  videoFormat: 'long' as const,
  aspectRatio: '16:9' as const,
  templateId: 'default',
  autoPublish: false,
  reviewRequired: true,
  ideasPerRun: 5,
  language: 'es',
  targetDurationMinSec: 480,
  targetDurationMaxSec: 900,
} satisfies ChannelConfig;

describe('prompt-pipeline', () => {
  it('narration rules differ for long vs shorts', () => {
    const long = getNarrationQualityRules('es', 'long');
    const shorts = getNarrationQualityRules('es', 'shorts');
    expect(long).toContain('Documental largo');
    expect(shorts).toContain('Shorts');
    expect(long).toContain('TTS');
  });

  it('idea system hints demand depth for long format', () => {
    const hints = getIdeaPipelineSystemHints(baseConfig);
    expect(hints).toContain('español');
    expect(hints).toMatch(/documental|palabras/i);
    expect(hints).toContain('angle');
  });

  it('script body includes metadata + visual mode rules', () => {
    const body = getScriptBodyPipelineHints(baseConfig, 'mixed');
    expect(body).toContain('METADATA');
    expect(body).toContain('pares');
    expect(body).toContain('TTS');
  });

  it('teaser hints enforce CTA shape', () => {
    const teaser = getTeaserPipelineHints(baseConfig, 'image');
    expect(teaser).toContain('CTA');
    expect(teaser).toContain('15-30');
  });

  it('metadata rules for shorts leave #Shorts margin', () => {
    expect(getScriptMetadataRules('shorts')).toContain('Short');
    expect(getScriptMetadataRules('long')).toContain('SEO');
  });
});

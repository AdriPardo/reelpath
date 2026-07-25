import type { ChannelConfig } from '@autotube/shared';

export interface ComplianceViolation {
  field: string;
  message: string;
}

interface ComplianceRule {
  id: string;
  patterns: RegExp[];
  message: string;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: 'weapons',
    patterns: [
      /\b(armas?|explosivos?|bombas?|granadas?|fusiles?|pistolas?|metralletas?)\b/i,
      /\b(weapon|gun|firearm|explosive|ammunition)\b/i,
    ],
    message: 'No se permiten canales centrados en armas, explosivos o violencia armada.',
  },
  {
    id: 'drugs',
    patterns: [
      /\b(drogas?|narcotr[aá]fico|coca[ií]na|hero[ií]na|metanfetamina|fentanilo)\b/i,
      /\b(drug\s*dealing|illegal\s*substance|narcotic)\b/i,
    ],
    message: 'No se permiten canales que promuevan drogas ilegales o su comercialización.',
  },
  {
    id: 'hate',
    patterns: [
      /\b(nazi|nazismo|supremac[ií]a\s*racial|genocidio\s*justificado)\b/i,
      /\b(hate\s*speech|white\s*supremacy|racial\s*hatred)\b/i,
    ],
    message: 'No se permiten canales con discurso de odio, supremacía o incitación a la violencia.',
  },
  {
    id: 'csam',
    patterns: [
      /\b(pornograf[ií]a\s*infantil|menores?\s*sexual|csam|pedofil)/i,
      /\b(child\s*porn|underage\s*sexual)\b/i,
    ],
    message: 'Contenido sexual con menores está estrictamente prohibido por ley.',
  },
  {
    id: 'fraud',
    patterns: [
      /\b(estafa|phishing|pirater[ií]a\s*financiera|lavado\s*de\s*dinero)\b/i,
      /\b(financial\s*fraud|money\s*laundering|scam\s*scheme)\b/i,
    ],
    message: 'No se permiten canales que promuevan estafas, fraude o actividades ilícitas.',
  },
  {
    id: 'self_harm',
    patterns: [
      /\b(suicidio\s*como\s*soluci[oó]n|autolesi[oó]n\s*tutorial|pro-?anorexia)\b/i,
      /\b(suicide\s*method|self[\s-]?harm\s*guide|pro[\s-]?ana)\b/i,
    ],
    message: 'No se permiten canales que instruyan o glorifiquen autolesión o suicidio.',
  },
];

function collectText(config: Partial<ChannelConfig>, channelName?: string, channelNiche?: string): string {
  const parts = [
    channelName,
    channelNiche,
    config.niche,
    config.brandName,
    config.tone,
    config.targetAudience,
    config.customPromptHints,
    ...(config.forbiddenTopics ?? []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function matchRules(text: string): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  for (const rule of COMPLIANCE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      violations.push({ field: rule.id, message: rule.message });
    }
  }
  return violations;
}

export function validateChannelCompliance(
  config: Partial<ChannelConfig>,
  options?: { channelName?: string; channelNiche?: string },
): ComplianceViolation[] {
  const text = collectText(config, options?.channelName, options?.channelNiche);
  return matchRules(text);
}

export function assertChannelCompliance(
  config: Partial<ChannelConfig>,
  options?: { channelName?: string; channelNiche?: string },
): void {
  const violations = validateChannelCompliance(config, options);
  if (violations.length > 0) {
    const err = new Error(violations.map((v) => v.message).join(' '));
    (err as Error & { violations: ComplianceViolation[] }).violations = violations;
    throw err;
  }
}

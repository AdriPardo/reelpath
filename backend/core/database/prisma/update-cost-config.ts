/**
 * One-off: update demo channel + prompt templates for cost optimization.
 * Safe to re-run.
 */
import { prisma } from '../src/index.js';

const PROMPT_UPDATES = [
  {
    type: 'idea_generation',
    version: '1.0.0',
    template: `Genera {{count}} ideas breves de vídeo YouTube Shorts para nicho "{{niche}}". Idioma: {{language}}. Tendencias: {{trends}}

JSON object con clave "ideas": array de { title (max 60 chars), hook (max 80 chars), angle, targetAudience, trendAlignment (0-1), rationale (max 100 chars) }. Sin texto extra.`,
  },
  {
    type: 'script_generation',
    version: '1.0.0',
    template: `Guion YouTube Shorts. Idea: {{title}} / {{hook}} / {{angle}}. Idioma: {{language}}.

JSON: { title, description (max 200 chars), tags (max 5), variantA: { hook, scenes }, variantB: { hook, scenes } }
Máximo 3 escenas por variante. Cada escena: narration (max 15 palabras), visualPrompt (breve), durationSec (3-5).`,
  },
];

async function main() {
  const channel = await prisma.channel.findUnique({ where: { slug: 'demo-tech' } });
  if (channel) {
    const config = channel.config as Record<string, unknown>;
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        config: { ...config, ideasPerRun: 3 },
      },
    });
    console.log('Updated demo-tech channel: ideasPerRun=3');
  }

  for (const p of PROMPT_UPDATES) {
    await prisma.promptVersion.updateMany({
      where: { type: p.type, version: p.version },
      data: { template: p.template },
    });
    console.log(`Updated prompt: ${p.type} ${p.version}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

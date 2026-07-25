#!/usr/bin/env tsx
/**
 * Lanza pipeline con un tema concreto.
 *
 * Uso:
 *   npm run pipeline:topic -- "El enigma de la ciudad perdida de Ubar"
 */
import 'dotenv/config';
import { prisma } from '@autotube/database';
import { enqueuePipeline } from '@autotube/job-queue';

async function main() {
  const topic = process.argv.slice(2).join(' ').trim();
  if (!topic) {
    console.error('Uso: npm run pipeline:topic -- <tema>');
    console.error('Ej:  npm run pipeline:topic -- "El enigma de la ciudad perdida de Ubar"');
    process.exit(1);
  }

  const channel = await prisma.channel.findFirst({
    where: { slug: 'curiosidades-historia', isActive: true },
  });
  if (!channel) {
    console.error('Canal curiosidades-historia no encontrado. Ejecuta: npm run db:seed');
    process.exit(1);
  }

  const run = await prisma.pipelineRun.create({
    data: {
      channelId: channel.id,
      status: 'scheduled',
      currentStep: 'generate_ideas',
      metadata: { forcedTopic: topic },
    },
  });

  const job = await enqueuePipeline({ pipelineRunId: run.id, channelId: channel.id });

  console.log(`\n✅ Pipeline encolado — tema: "${topic}"`);
  console.log(`   pipelineRunId: ${run.id}`);
  console.log(`   jobId: ${job.id}`);
  console.log(`\nSigue el progreso en http://localhost:3000/pipelines`);
  console.log('Asegúrate de tener npm run dev corriendo (worker activo).\n');
}

main()
  .catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

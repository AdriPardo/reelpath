#!/usr/bin/env tsx
/**
 * Ejecuta un sweep de auto-generación (mismo código que el job horario del worker).
 * Uso: npx tsx scripts/auto-generate-sweep.ts
 */
import 'dotenv/config';
import { runAutoGenerateSweep } from '../worker/src/auto-generate-sweep.js';
import { closeQueues } from '@autotube/job-queue';
import { prisma } from '@autotube/database';

async function main() {
  const result = await runAutoGenerateSweep();
  console.log(JSON.stringify(result, null, 2));
  await closeQueues();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await closeQueues().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

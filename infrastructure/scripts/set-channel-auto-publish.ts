#!/usr/bin/env tsx
import 'dotenv/config';
import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';

async function main() {
  const slug = process.argv[2] ?? 'curiosidades-historia';
  const reviewRequired = process.argv[3] === 'true';

  const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } });
  const config = parseChannelConfig(channel.config);

  const updated = {
    ...config,
    reviewRequired,
    autoPublish: !reviewRequired,
  };

  await prisma.channel.update({
    where: { id: channel.id },
    data: { config: updated },
  });

  console.log(`Canal "${channel.name}" (${slug}): reviewRequired=${reviewRequired}, autoPublish=${!reviewRequired}`);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

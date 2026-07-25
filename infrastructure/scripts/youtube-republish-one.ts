#!/usr/bin/env tsx
import 'dotenv/config';
import { publishToYouTube } from '@autotube/youtube-publisher';

async function main() {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error('Uso: tsx youtube-republish-one.ts <videoId>');
    process.exit(1);
  }

  console.log(`Subiendo ${videoId} a YouTube...`);
  const result = await publishToYouTube(videoId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Demo E2E: idea → script → voice → video (sin Redis si falla, ejecuta inline)
 */
import 'dotenv/config';
import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { generateIdeas, ensureSelectedIdea } from '@autotube/idea-generator';
import { generateMedia } from '@autotube/media-generator';
import { generateScript } from '@autotube/script-generator';
import type { ScriptVariant } from '@autotube/shared';
import { renderVideo } from '@autotube/video-renderer';

async function main() {
  console.log('🚀 AutoTube E2E Demo Pipeline\n');

  const channel = await prisma.channel.findFirst({
    where: { slug: 'curiosidades-historia', isActive: true },
  });
  if (!channel) {
    console.error('Run db:seed first');
    process.exit(1);
  }

  const config = parseChannelConfig(channel.config);

  const pipelineRun = await prisma.pipelineRun.create({
    data: { channelId: channel.id, status: 'scheduled', currentStep: 'generate_ideas' },
  });

  console.log(`📋 Pipeline run: ${pipelineRun.id}`);

  console.log('\n1️⃣  Generating ideas...');
  const ideas = await generateIdeas({ channelId: channel.id, pipelineRunId: pipelineRun.id, config });
  console.log(`   Generated ${ideas.length} ideas. Top score: ${ideas[0]?.viralScore}`);

  console.log('\n2️⃣  Selecting best idea...');
  const selected = await ensureSelectedIdea({
    channelId: channel.id,
    pipelineRunId: pipelineRun.id,
    config,
  });
  if (!selected) {
    console.error('No idea met minimum viral score after retries');
    process.exit(1);
  }
  console.log(`   Selected: "${selected.title}" (score: ${selected.viralScore})`);

  console.log('\n3️⃣  Generating script with A/B hooks...');
  const script = await generateScript({
    channelId: channel.id,
    pipelineRunId: pipelineRun.id,
    config,
    idea: { title: selected!.title, hook: selected!.hook, angle: selected!.angle },
  });
  console.log(`   Hook variant ${script.selectedVariant.hookVariant}: "${script.selectedVariant.hook}"`);
  console.log(`   Scenes: ${script.selectedVariant.scenes.length}`);

  console.log('\n4️⃣  Generating media (TTS + images + subtitles)...');
  const assets = await generateMedia({
    pipelineRunId: pipelineRun.id,
    script: script.selectedVariant,
    language: config.language,
    aspectRatio: config.aspectRatio,
  });
  console.log(`   Assets: ${assets.length} files`);

  console.log('\n5️⃣  Rendering video (FFmpeg)...');
  const result = await renderVideo({
    pipelineRunId: pipelineRun.id,
    channelId: channel.id,
    templateId: config.templateId,
    script: script.selectedVariant,
    assets,
    title: script.title,
    description: script.description,
    tags: script.tags,
    format: config.videoFormat,
    aspectRatio: config.aspectRatio,
    reviewRequired: config.reviewRequired,
  });

  await prisma.pipelineRun.update({
    where: { id: pipelineRun.id },
    data: { status: 'pending_review', currentStep: 'await_review' },
  });

  console.log('\n✅ Pipeline complete!');
  console.log(`   Video ID: ${result.videoId}`);
  console.log(`   File: ${result.filePath}`);
  console.log(`   Duration: ${result.durationSec}s`);
  console.log(`\n   Approve via: POST /api/videos/${result.videoId}/approve`);
}

main()
  .catch((e) => {
    console.error('Pipeline failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

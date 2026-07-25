import 'dotenv/config';
import OpenAI from 'openai';
import { loadConfig } from '@autotube/config';

async function main() {
  const config = loadConfig();
  console.log('GENERATE_DALLE_IMAGES', config.GENERATE_DALLE_IMAGES);
  console.log('OPENAI_IMAGE_MODEL', config.OPENAI_IMAGE_MODEL);
  console.log('useMocks', config.useMocks);

  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  for (const model of [config.OPENAI_IMAGE_MODEL, 'gpt-image-1', 'dall-e-3', 'dall-e-2']) {
    try {
      const isGptImage = model.startsWith('gpt-image');
      const size = isGptImage
        ? '1536x1024'
        : model === 'dall-e-2'
          ? '1024x1024'
          : '1792x1024';
      const r = await client.images.generate({
        model,
        prompt: 'Ancient Mayan temple at sunset, cinematic, no text',
        size: size as '1536x1024',
        n: 1,
      });
      const item = r.data?.[0];
      console.log(`✅ ${model}:`, item?.url ? 'url' : item?.b64_json ? 'b64' : 'empty');
    } catch (e) {
      console.log(`❌ ${model}:`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch(console.error);

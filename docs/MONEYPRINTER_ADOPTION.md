# Adopción desde MoneyPrinterTurbo

Investigación de [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT) frente a Reelpath.

**No** se copia el monolito Python/MoviePy/WebUI. Se portan **patrones y algoritmos** al stack TS existente.

## Ya tenemos (skip)

| Capacidad | Reelpath |
|-----------|----------|
| TTS multi + fallback | Edge / ElevenLabs / OpenAI |
| Subtítulos SRT + karaoke ASS | `packages/shared`, `clip-subtitles` |
| Ken Burns / motion | `video-motion.ts` (más rico que MPT) |
| Transiciones xfade | `video-renderer` |
| Stock Pexels | `stock-provider.ts` |
| Publish YouTube + Shorts | `youtube-publisher` |
| Ideas / guion / retención / planner | servicios propios |
| SaaS multi-tenant + review | pipeline + BD |

## Valor alto / P0 (adoptado)

1. **BGM mix + sidechain duck** — `bgm-mix.ts`; canal `bgmEnabled` / `bgmVolume` / `bgmFile` + UI upload.
2. **Keywords stock EN** — heurística + `stockQuery` + LLM opcional ordenado.
3. **Multi-provider stock** — Pexels → Pixabay → Coverr + cache 24h + dedup fuentes.
4. **WordBoundary Edge → ASS/SRT** — sync karaoke real vía `getWordBoundaries()`.
5. **TTS timeout/retry + cleanup 0B** — `EDGE_TTS_TIMEOUT_SEC` / `EDGE_TTS_RETRIES`.
6. **Atribución stock + redact + CF detect** — metadata creator/página; Pixabay CF challenge.
7. **Metadata social multi-plataforma** — `social-metadata.ts` + Shorts/cross-post helpers.
8. **Rotación API keys** — `nextRotatedSecret` (listas `key1,key2`).
9. **Purge cache stock** — API + `npm run storage:cleanup -- --stock-cache`.
10. **clip_speed stock** — `ChannelConfig.stockPlaybackSpeed`.
11. **Preflight pipeline** — keys/TTS/BGM antes de gastar LLM.
12. **Contraste/glyphs subtítulos** — `warnSubtitleStyle`.

## P1 (adoptado)

1. **Voice preview reuse cache** — fingerprint provider+voz+texto+lang → `storage/cache/tts-preview` + memoria (`tts-preview-cache.ts`).
2. **Stock relevance rerank (sin TwelveLabs)** — Jaccard léxico `stock-relevance.ts` (boost candidatos + log subject-relevance).
3. **UI canal BGM / TTS preview / secrets Pixabay·Coverr / QA duro / analytics apply-hour / onboarding review / BYOK ElevenLabs**.

## P2 (adoptado)

1. **Cross-post Upload-Post** — `youtube-publisher/upload-post.ts`; canal `crossPostEnabled`; secretos plataforma `upload_post`; publish pipeline.
2. **Landing SaaS** — hero marca Reelpath + pilares org/planes/BYOK (`MarketingHome`).
3. **PRODUCT UX P1/P2** — checklist, 2.º canal, OAuth unavailable, jerga «generaciones», PageHeader (ya en código).

## Bajo / no adoptar

- Monolito Python, MoviePy, Streamlit WebUI
- Whisper ASR + Levenshtein
- Proliferación TTS (Azure/Gemini/Chatterbox…)
- Sonilo / ElevenLabs Music como P0
- Bundled songs de MPT
- Fonts chinos embebidos
- TwelveLabs Marengo/Pegasus de pago (sustituido por rerank léxico)

## Licencia

MPT = MIT → ideas y patrones OK. No copy-paste del monolito ni de `resource/songs/`.

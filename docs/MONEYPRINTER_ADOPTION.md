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

## Valor alto (adoptado)

1. **BGM mix + sidechain duck** — `bgm-mix.ts`; canal `bgmEnabled` / `bgmVolume` / `bgmFile`.
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

## Valor medio (backlog restante)

- Voice preview reuse cache
- TwelveLabs rerank (caro)
- Cross-post Upload-Post real (TikTok/IG API)

## Bajo / no adoptar

- Monolito Python, MoviePy, Streamlit WebUI
- Whisper ASR + Levenshtein
- Proliferación TTS (Azure/Gemini/Chatterbox…)
- Sonilo / ElevenLabs Music como P0
- Bundled songs de MPT
- Fonts chinos embebidos

## Licencia

MPT = MIT → ideas y patrones OK. No copy-paste del monolito ni de `resource/songs/`.

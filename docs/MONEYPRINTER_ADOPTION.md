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

1. **BGM mix** — Reelpath no tenía música de fondo. Librería en `storage/bgm` + `resource/bgm`, volumen, loop, fade-out, fail-soft. Config canal: `bgmEnabled` / `bgmVolume` / `bgmFile`.
2. **Keywords stock orientadas a búsqueda** — Heurística EN 1–3 palabras + campo opcional `stockQuery` por escena + generación LLM opcional (orden guion).
3. **Multi-provider stock + cache + dedup** — Pexels → Pixabay → Coverr; cache disco 24h; evita reutilizar el mismo `assetId` entre escenas del mismo vídeo.

## Valor medio (backlog)

- Edge TTS `WordBoundary` → cues reales (hoy SRT proporcional a chars)
- Metadata social multi-plataforma (TikTok/IG captions)
- Cross-post Upload-Post / TikTok / IG
- Rotación de API keys thread-safe
- Sidechain ducking BGM bajo voz (`sidechaincompress`)
- TwelveLabs rerank (solo si volumen stock alto)

## Bajo / no adoptar

- Monolito Python, MoviePy, Streamlit WebUI
- Whisper ASR (Reelpath sincroniza desde guion+TTS)
- Proliferación TTS (Azure/Gemini/Chatterbox…)
- Sonilo / ElevenLabs Music como P0 (caro; primero librería local)
- Bundled songs de MPT (no redistribuir; usuario aporta tracks royalty-free)
- Fonts chinos embebidos

## Licencia

MPT = MIT → ideas y patrones OK. No copy-paste del monolito ni de `resource/songs/`.

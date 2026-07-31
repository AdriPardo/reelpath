# Platform AI secrets (ops)

Reelpath **no** pide API keys de IA al end-user. Ops / Atlas las inyectan ([ADR-0017](https://github.com/AdriPardo/atlas)).

## Resolución runtime

`OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `ELEVENLABS_API_KEY` / `PEXELS_API_KEY`:

1. **Atlas env** (envFrom → `.env` del workspace / process.env) — preferido
2. **PlatformSecret** (BD cifrada) — fallback migración
3. Leftover org BYOK en BD — último recurso; UI BYOK retirada

No se borran filas `PlatformSecret` en deploy ni cutover.

## Preferido: Atlas + envFrom

1. En el host Atlas, rellenar `.env.secrets` (gitignored) desde `scripts/env.secrets.example` del repo Atlas.
2. Correr:

```bash
# En repo Atlas (VM)
export ATLAS_ADMIN_USERNAME=... ATLAS_ADMIN_PASSWORD=...
./scripts/seed-project-secrets.sh
# opcional bridge PlatformSecret:
# REELPATH_SEED_PLATFORM=1 ./scripts/seed-project-secrets.sh
```

3. `atlas.yml` declara `envFrom` `AUTH_SECRET` / `CREDENTIALS_ENCRYPTION_KEY` + `ai.openai` / `ai.elevenlabs` / `ai.deepseek` → deploy escribe keys en `.env`.
4. Redeploy Reelpath.

## Bridge local (PlatformSecret en DB app)

Mientras hace falta fallback sin env:

```bash
# En repo Reelpath / container API — upsert (sobrescribe en rotate)
OPENAI_API_KEY=... ELEVENLABS_API_KEY=... DEEPSEEK_API_KEY=... \
  npm run secrets:seed-from-env
```

`secrets:import-from-env` solo importa si vacío (boot legacy). `secrets:seed-from-env` = rotate explícito.

## UI

- End-user Ajustes: solo estado de keys (sin paste).
- Formularios AI / YouTube: **Admin → Infra** (`PLATFORM_ADMIN_EMAILS`).
- PATCH org con `openaiApiKey` / etc. → 403.

## Reglas

- Nunca commit de valores reales.
- No `compose down -v` ni wipe DB para rotar keys.

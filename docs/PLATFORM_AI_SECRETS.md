# Platform AI secrets (ops)

Reelpath **no** pide API keys de IA al end-user. Plataforma / ops las posee ([Atlas ADR-0017](https://github.com/AdriPardo/atlas)).

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

3. `atlas.yml` declara `envFrom` `ai.openai` / `ai.elevenlabs` / `ai.deepseek` → deploy escribe `OPENAI_API_KEY` etc. en `.env`.
4. Redeploy Reelpath.

## Bridge local (PlatformSecret en DB app)

Mientras runtime aún lee `PlatformSecret` (migración):

```bash
# En repo Reelpath / container API — upsert (sobrescribe en rotate)
OPENAI_API_KEY=... ELEVENLABS_API_KEY=... DEEPSEEK_API_KEY=... \
  npm run secrets:seed-from-env
```

`secrets:import-from-env` solo importa si vacío (boot legacy). `secrets:seed-from-env` = rotate explícito.

## Reglas

- Nunca commit de valores reales.
- End-user UI “Secretos de plataforma” para AI: ocultar / ops-only.
- No `compose down -v` ni wipe DB para rotar keys.

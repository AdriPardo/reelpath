# Reelpath — Documento de producto

> Última revisión: julio 2026. Inventario honesto de qué es Reelpath hoy, qué promete y qué falta.

---

## 1. Propuesta de valor

**Reelpath** es una plataforma SaaS para **creadores de contenido** que quieren producir y publicar vídeos educativos o de nicho en **YouTube** (formato largo y Shorts verticales) con ayuda de inteligencia artificial.

Para el creador, Reelpath significa:

- **Un solo panel** donde gestiona sus canales, genera vídeos con IA, los revisa y los publica.
- **Varios canales** bajo una organización (su cuenta de cliente), cada uno con su nicho, estilo y cuenta de YouTube conectada.
- **Flujo guiado**: idea → guion → voz e imágenes → vídeo renderizado → revisión humana → publicación en YouTube.

Reelpath **no** es el canal de YouTube del creador (p. ej. «Saberes del Pasado»). Es la **herramienta de producción** detrás del canal.

---

## 2. Flujo ideal del usuario

```
Registro → Dashboard → Crear canal → Conectar YouTube → Generar vídeo → Revisar → Publicar
```

| Paso | Pantalla | Acción del creador |
|------|----------|---------------------|
| 1 | `/register` | Crea cuenta; se crea automáticamente su organización (14 días de prueba) |
| 2 | `/` (Dashboard) | Ve checklist de inicio y resumen de actividad |
| 3 | `/channels` | Crea un canal (nombre + nicho) |
| 4 | `/channels/[id]?tab=integraciones` | Conecta la cuenta de YouTube |
| 5 | `/channels` o detalle del canal | Pulsa «Generar vídeo» (tema opcional) |
| 6 | `/pipelines` (UI: **Generaciones**) | Sigue el progreso en tiempo real |
| 7 | `/review` | Aprueba o rechaza el vídeo antes de publicar |
| 8 | `/videos` | Consulta biblioteca, Shorts, republicar |

**Publicación tras aprobar:** YouTube publica automáticamente (o en la fecha programada). Los Shorts verticales se publican en el mismo flujo de YouTube.

**Programación:** En `/review` puedes elegir «Publicar ahora» o «Programar» con fecha/hora. Al generar un vídeo desde un canal también puedes marcar «Programar publicación en YouTube». El vídeo queda en estado *Programado* hasta que el worker publica en el momento indicado (job BullMQ con delay).

---

## 3. Funcionalidades actuales (inventario honesto)

### ✅ Funciona de punta a punta

| Área | Estado | Notas |
|------|--------|-------|
| Auth (login/registro) | ✅ | JWT, org automática al registrarse, sin slug visible |
| Multi-tenant | ✅ | Organizaciones aisladas; canales por org |
| CRUD canales | ✅ | Nombre, nicho, config JSON (tono, revisión, Shorts…) |
| Generación IA | ✅ | Pipeline completo: ideas, guion, TTS, imágenes, render |
| Modo retención | ✅ | Toggle por canal: ganchos, ritmo, subtítulos y TTS optimizados |
| Cola de revisión | ✅ | Aprobar → publica YouTube (o programar); rechazar → borra assets |
| Biblioteca de vídeos | ✅ | Filtros, búsqueda, reproductor, edición metadatos |
| Generaciones en vivo | ✅ | Progreso, reintentar, reanudar |
| Integraciones UI | ✅ | Estado por canal, privacidad, conectar/desconectar YouTube |
| Planes y facturación | ✅ | Trial + Stripe Checkout + webhooks; límites enforced en API |
| Tema claro/oscuro | ✅ | Persistido en localStorage |

### ⚠️ Parcial / legacy

| Área | Estado | Notas |
|------|--------|-------|
| OAuth YouTube | ✅ | Flujo OAuth por canal en UI (`ChannelIntegrationsPanel`) |
| Stock vídeo (Pexels) | ✅ | Modo `stock`/`mixed` por canal; badges de origen en revisión |
| Invitaciones de equipo | ✅ | Invitar por email, aceptar en `/invite/[token]` |
| BYOK OpenAI | ⚠️ | API key por organización en Ajustes; workers la usan en pipeline |
| Credenciales por canal | ⚠️ | API + BD listas; **workers aún leen `.env` como fallback** |
| Analytics | ⚠️ | Sync en pipeline; visualización limitada en UI |
| Ajustes globales | ⚠️ | Cuenta/plan OK; publicación redirige a canales (correcto) |

### ❌ Stub o ausente

| Área | Estado |
|------|--------|
| Pago por vídeo suelto (19/29 EUR) | ❌ Próximamente |
| OAuth Google en UI | ⚠️ | Requiere credenciales de plataforma en `.env` |
| BYOK ElevenLabs | ❌ | Solo OpenAI a nivel org por ahora |
| Onboarding email / tours | ⚠️ | Email bienvenida al registrarse; sin tour guiado |
| Multi-usuario por org (invitar) | ✅ | Invitaciones por email + roles owner/member |

### Legacy `.env` (operador, no creador)

En despliegues actuales, el operador de Reelpath puede tener YouTube/OpenAI en `.env`. La UI permite «vincular desde plataforma» en dev. **El creador final no debería ver `.env` ni jerga de despliegue**.

---

## 4. Problemas de UX detectados

Prioridad **P0** (bloquean confianza) → **P2** (pulido).

| P | Problema | Impacto |
|---|----------|---------|
| P0 | Tras login iba a `/channels`, no al Dashboard | No hay «hogar» ni onboarding claro |
| P0 | Nav sin Dashboard; «Pipelines» es jerga técnica | Desorienta al creador |
| P0 | Dashboard mezclaba credenciales globales (`.env`) con modelo por canal | Mensajes contradictorios |
| P1 | Sin checklist de primeros pasos | Usuario nuevo no sabe qué hacer |
| P1 | Imposible crear 2.º canal desde UI con canales existentes | Escala mal |
| P1 | Ajustes vs integraciones por canal duplicaba conceptos | Ya mitigado; publicación redirige a canales |
| P1 | OAuth no disponible sin mensaje claro al creador | Frustración al conectar cuentas |
| P2 | Planes muestran «pipelines/día» | Jerga interna |
| P2 | Algunos subtítulos de página inconsistentes | Menor coherencia de tono |
| P2 | Landing no vende Reelpath como SaaS | Confusión marca plataforma vs canal demo |

---

## 4bis. Pulido de experiencia (julio 2026)

Pasada de calidad transversal para que la app se sienta premium y pulida. No fue reescritura: mejoras enfocadas sobre la base ya existente.

| Área | Mejora | Archivos |
|------|--------|----------|
| Rendimiento percibido | **Skeletons de carga** por ruta (`loading.tsx`) en Inicio, Canales, Vídeos, Revisión y Generaciones — feedback instantáneo al navegar en lugar de pantalla en blanco | `app/**/loading.tsx`, `components/ui/Skeleton.tsx`, `globals.css` |
| Feedback | **Toasts rediseñados**: iconos por tipo, botón de cerrar, colores adaptados a tema claro/oscuro (antes fijos oscuros), nuevo tipo `celebrate` | `components/ui/Toast.tsx`, `globals.css` |
| Delight | **Celebración al aprobar** un vídeo en `/review`: tarjeta de confirmación animada + toast festivo en vez de una simple etiqueta | `components/ReviewActions.tsx`, `globals.css` |
| Primera impresión | **Home pública rediseñada**: hero con degradado, flujo «Genera · Revisa · Publica», rejilla de funciones con iconos | `components/MarketingHome.tsx`, `globals.css` |
| Estados de error | **Páginas 404 y de error** con diseño de marca y acciones de recuperación | `app/not-found.tsx`, `app/error.tsx`, `globals.css` |
| Copy / SEO | **Títulos de pestaña corregidos** — se eliminaba el sufijo duplicado «— AutoTube — AutoTube» al combinarse con la plantilla del layout | todas las `metadata` de página |

---

## 5. Roadmap recomendado

### Fase A — Coherencia de producto (esta sesión + corto plazo)

- [x] Dashboard con bienvenida, checklist y acciones rápidas
- [x] Nav: Dashboard · Canales · Vídeos · Revisión · Generaciones · Ajustes
- [x] Renombrar «Pipelines» → «Generaciones» en UI
- [x] Crear canal adicional desde `/channels`
- [x] Skeletons de carga por ruta (rendimiento percibido)
- [x] Toasts con iconos, cierre y colores por tema
- [x] Celebración al aprobar vídeo en revisión
- [x] Home pública rediseñada (hero + pasos + funciones)
- [x] Páginas 404 / error con marca
- [x] Títulos de pestaña sin marca duplicada
- [ ] Redirigir registro al Dashboard (hecho en código)
- [x] Subtítulos PageHeader unificados en lenguaje creador

### Fase B — Conexión real (2–4 semanas)

1. OAuth YouTube por canal (sin pegar tokens)
2. Workers leen `IntegrationCredential` del `channelId`
3. Quitar fallback `.env` en producción multi-tenant
4. Mensajes de error de integración accionables en UI

### Fase C — Monetización (4–6 semanas)

1. Stripe Checkout + webhooks
2. Enforcement de límites (canales, vídeos/mes)
3. Upgrade/downgrade en ajustes
4. Emails de trial expirado

### Fase D — Escala creador (6+ semanas)

1. Landing comercial Reelpath (caso Saberes del Pasado + FAQ)
2. Invitar miembros a la organización
3. BYOK de APIs de IA por organización
4. Analytics dashboard por canal
5. Plantillas de nicho / presets de contenido

---

## Mapa de pantallas (IA de navegación)

```
/ ........................ Dashboard (inicio, resumen, onboarding)
/channels ................ Hub de canales (crear, generar)
/channels/[id] ............. General · Contenido · Integraciones
/videos .................... Biblioteca
/videos/[id] ............... Detalle, Shorts, revisión
/review .................... Cola de aprobación pre-publicación
/pipelines ................. Generaciones (ruta interna; UI: Generaciones)
/settings .................. Cuenta, plan, preferencias
/login · /register ......... Auth
/landing ................... Sitio público demo (canal creador)
(404) ...................... not-found con marca y acciones
(error) .................... error boundary con reintento
(loading) .................. skeletons por ruta durante SSR
```

---

## Modo retención (por canal)

En **Canales → [canal] → Contenido → Modo retención** el pipeline aplica:

| Etapa | Cambio |
|-------|--------|
| Ideas | Hooks tipo scroll-stop; ángulos virales de historia; penaliza listas y clickbait vacío |
| Guion | Gancho en escena 1 (<3 s); micro-ganchos cada 2 escenas; cliffhanger al cierre |
| TTS | Ritmo +5–8 % más dinámico; comas de énfasis en el guion |
| Imágenes | Validación de `visualPrompt` únicos (menos fallbacks genéricos) |
| Render | Ken Burns más rápido, cortes directos, subtítulos más grandes y frases cortas |

**Puntuación mínima de viralidad:** con `minViralScore` ≥ 65 (recomendado para canales tipo Saberes del Pasado) el generador reintenta ideas hasta 5 veces si ninguna alcanza el umbral.

**Probar:** activar el toggle en un canal, poner `minViralScore` en 65, generar un vídeo y revisar en `/review` que la primera escena abre con pregunta o dato impactante, que hay micro-ganchos en escenas intermedias y subtítulos legibles en móvil.

---

## Contenido generado por IA (YouTube)

| Qué hace Reelpath | Detalle |
|-------------------|---------|
| Revisión humana | Por defecto cada vídeo requiere aprobación antes de publicar |
| Metadatos técnicos | Las imágenes se re-exportan sin EXIF/C2PA cuando aplica |
| Políticas YouTube | El creador debe cumplir las normas de la plataforma sobre contenido sintético |

**Recomendación:** mantener revisión activa si el pipeline usa LLM, TTS e imágenes IA. Para reducir fricción: voz humana, edición manual y B-roll propio cuando proceda.

---

## Glosario (solo documentación; no usar en UI)

| Término interno | En UI para el creador |
|-----------------|----------------------|
| Pipeline | Generación |
| Organization | Tu espacio / tu cuenta |
| IntegrationCredential | Cuenta conectada |
| Slug | *(oculto)* |
| BYOK | «Conecta tu cuenta» |
| Worker | *(invisible)* |

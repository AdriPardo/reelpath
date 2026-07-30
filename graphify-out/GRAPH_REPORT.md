# Graph Report - .  (2026-07-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3179 nodes · 5648 edges · 221 communities (191 shown, 30 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8bcc1f61`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- translate
- api/src/index.ts
- user-messages.ts
- api.ts
- countWords
- AuthContext.tsx
- site-brand.ts
- navigation.ts
- ThemeContext.tsx
- videos/page.tsx
- ChannelDetailTabs.tsx
- videos/[id]/page.tsx
- getOrgPipelineOverrides
- media-providers.ts
- Nav.tsx
- useToast
- retention.ts
- seed.ts
- video-renderer/src/index.ts
- frontend/src/lib/auth-cookie.ts
- [locale]/layout.tsx
- HelpCenter.tsx
- a/[slug]/page.tsx
- database/src/index.ts
- HelpSearch.tsx
- @autotube/config
- middleware/auth.ts
- PipelineDetailLive.tsx
- stripe-webhook.ts
- videos.ts
- SettingsPlanPanel.tsx
- dependencies
- LegalArticles.tsx
- channels.ts
- config-system/src/index.ts
- scripts
- shared/src/types.ts
- Skeleton.tsx
- publication-planner.ts
- llm/src/index.ts
- analytics/src/index.ts
- pipeline.ts
- scripts
- youtube-publisher/src/index.ts
- [locale]/page.tsx
- compilerOptions
- config-system/package.json
- api/src/lib/plan-limits.ts
- resolve-settings.ts
- routes/auth.ts
- analytics/package.json
- idea-generator/package.json
- dependencies
- media-generator/package.json
- video-renderer/package.json
- script-generator/package.json
- Reelpath SaaS — Fase 1 (multi-tenant)
- HelpHome.tsx
- video-encoding.ts
- pre-deploy-check.ts
- job-queue/package.json
- email.ts
- Facturación y suscripciones (Stripe)
- Reelpath — Documento de producto
- credential-crypto.ts
- youtube-publisher/package.json
- shared/package.json
- pipeline-cleanup.ts
- shared/src/index.ts
- dependencies
- lib/notifications.ts
- llm/package.json
- prompt-engine/package.json
- template-engine/package.json
- sync-skills.sh
- MarkdownArticle.tsx
- devDependencies
- job-queue/src/index.ts
- content-scorer/package.json
- Despliegue de Reelpath en producción
- UI Help
- Planificador de publicación (Publication Planner)
- helpers/auth.ts
- HelpArticle.tsx
- help-content.ts
- duration.ts
- video-motion.ts
- compilerOptions
- compilerOptions
- content-scorer/src/index.ts
- idea-generator/src/index.ts
- Checklist completo (pre-deploy)
- merge-i18n-extensions.mjs
- pipeline-recovery.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- Guía de usuario — Reelpath
- Emails transaccionales (Reelpath)
- publication-plan.ts
- Pasos de despliegue
- compilerOptions
- Capas del sistema
- api/package.json
- loadConfig
- help-search.ts
- setup-stripe-products.ts
- Backups
- Reelpath — Arquitectura del Sistema
- PromptEngine
- devDependencies
- Alertas externas (Sentry / Prometheus)
- Política de contenido de canales
- tts-voices.ts
- verify-stripe-config.ts
- channel-compliance.ts
- Conectar YouTube
- Revisar y publicar
- Analíticas
- Planes y facturación
- Solución de problemas
- Connect YouTube
- Review and publish
- Analytics
- Plans and billing
- Troubleshooting
- Clip desde upload
- 5. Conectar YouTube
- generate-app-icons.py
- srt.ts
- visual-origin.ts
- Reelpath
- Empezar con Reelpath
- Generar un vídeo
- Getting started with Reelpath
- Generate a video
- 15. Preguntas frecuentes
- Retención y borrado
- scripts/youtube-oauth.ts
- package.json
- workspaces
- shared/src/shorts.ts
- Quick Start (desarrollo local)
- 16. Solución de problemas
- 3. Tu cuenta y planes
- 4. Crear tu primer canal
- notifications.test.ts
- TemplateRegistry
- Equipo e invitaciones
- Team and invitations
- 2. Primeros pasos
- 7. Revisar y publicar
- Ajustes de canal
- next.config.mjs
- Riesgos y limitaciones
- 6. Generar tu primer vídeo
- 9. Analíticas
- login/layout.tsx
- register/layout.tsx
- instrumentation.ts
- instrumentation-client.ts
- youtube-set-thumbnail.ts
- healthcheck.ts
- test-email.ts
- 12. Equipo e invitaciones
- 1. Qué es Reelpath
- 8. Subir un vídeo que ya tienes
- pricing.ts
- kill-dev-ports.sh
- @autotube/database
- @autotube/video-renderer
- bcryptjs
- cors
- express
- express-async-errors
- googleapis
- ioredis
- jose
- pino
- pino-http
- prom-client
- @sentry/node
- zod
- next-env.d.ts
- deploy.sh
- deploy-prod.sh
- backup-db.sh
- backup-storage.sh
- restore-db.sh
- AutoTubeIcon

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 54 edges
2. `api()` - 49 edges
3. `countWords()` - 40 edges
4. `scripts` - 38 edges
5. `translate()` - 37 edges
6. `Button()` - 31 edges
7. `useAuth()` - 29 edges
8. `loadConfig()` - 24 edges
9. `AppLocale` - 21 edges
10. `Guía de usuario — Reelpath` - 20 edges

## Surprising Connections (you probably didn't know these)
- `searchHelpIndex()` --indirect_call--> `t()`  [INFERRED]
  frontend/src/lib/help/help-search.ts → backend/api/src/lib/i18n.ts
- `main()` --calls--> `cleanupPipelineRunStorage()`  [EXTRACTED]
  scripts/retention-cleanup.ts → backend/api/src/lib/pipeline-cleanup.ts
- `main()` --indirect_call--> `t()`  [INFERRED]
  backend/core/database/prisma/seed.js → backend/api/src/lib/i18n.ts
- `main()` --indirect_call--> `t()`  [INFERRED]
  backend/core/database/prisma/seed.ts → backend/api/src/lib/i18n.ts
- `cleanupRejected()` --calls--> `deletePipelineRunCompletely()`  [EXTRACTED]
  infrastructure/scripts/cleanup-storage.ts → backend/api/src/lib/pipeline-cleanup.ts

## Import Cycles
- 2-file cycle: `backend/core/database/src/index.ts -> backend/core/database/src/org-settings.ts -> backend/core/database/src/index.ts`
- 2-file cycle: `backend/core/database/src/index.ts -> backend/core/database/src/platform-secrets.ts -> backend/core/database/src/index.ts`
- 2-file cycle: `backend/core/config-system/src/index.ts -> backend/core/config-system/src/storage.ts -> backend/core/config-system/src/index.ts`

## Communities (221 total, 30 thin omitted)

### Community 0 - "translate"
Cohesion: 0.06
Nodes (43): detectLocale(), GlobalError(), ChannelCard(), IntegrationPill(), ChannelIntegrationsPanel(), IntegrationCard(), integrationChipVariant(), formatScheduledDate() (+35 more)

### Community 1 - "api/src/index.ts"
Cohesion: 0.10
Nodes (21): app, config, initSentryForApi(), installSentryErrorHandler(), installSentryMiddleware(), dirSizeBytes(), formatBytes(), getStorageStats() (+13 more)

### Community 2 - "user-messages.ts"
Cohesion: 0.13
Nodes (20): ApiStatusBanner(), SettingsDevPanel(), StorageStatsPanel(), minScheduleInputValue(), TriggerPipelineButton(), checkApiHealth(), getApiUrl(), StorageStats (+12 more)

### Community 3 - "api.ts"
Cohesion: 0.09
Nodes (32): ChannelAnalyticsPanel(), formatMinutes(), formatPct(), DashboardOrgAnalytics(), isSyncableChannel(), OrgAnalyticsSummary, ShortClipActions(), formatMinutes() (+24 more)

### Community 4 - "countWords"
Cohesion: 0.07
Nodes (95): assembleScript(), buildHookScene(), detectTransitionGaps(), expandScene(), expandScriptToMinDuration(), generatePaddingScene(), minimalOutline(), buildChunkCorrection() (+87 more)

### Community 5 - "AuthContext.tsx"
Cohesion: 0.18
Nodes (15): BillingPastDueBanner(), AuthContext, AuthContextValue, AuthGate(), AuthOrganization, AuthProvider(), AuthSession, AuthUser (+7 more)

### Community 6 - "site-brand.ts"
Cohesion: 0.22
Nodes (8): LoginPage(), RegisterPage(), BrandMark(), BrandMarkProps, MarketingHome(), DEMO_CHANNEL, LEGAL_URLS, PLATFORM

### Community 7 - "navigation.ts"
Cohesion: 0.22
Nodes (9): HelpFab(), LocaleSwitcherProps, { Link, redirect, usePathname, useRouter, getPathname }, locales, routing, isPublicPath(), PUBLIC_PATHS, stripLocalePrefix() (+1 more)

### Community 8 - "ThemeContext.tsx"
Cohesion: 0.17
Nodes (10): LocaleSwitcher(), SettingsPreferencesPanel(), ThemeToggle(), applyTheme(), getStoredTheme(), Theme, ThemeContext, ThemeContextValue (+2 more)

### Community 9 - "videos/page.tsx"
Cohesion: 0.07
Nodes (35): ChannelDetailPage(), ChannelsPage(), Props, generateMetadata(), PipelineDetailPage(), pipelinePageTitle(), parseFilter(), PipelineFilter (+27 more)

### Community 10 - "ChannelDetailTabs.tsx"
Cohesion: 0.09
Nodes (29): ChannelDetailTabs(), configChip(), shortsChip(), TabValue, ChannelGeneralForm(), ChannelPlannerSettings(), PlannerFormConfig, slotsToStrings() (+21 more)

### Community 11 - "videos/[id]/page.tsx"
Cohesion: 0.08
Nodes (34): VideoDetailPage(), QualityReportPanel(), scoreClass(), STATUS_META, ReviewActions(), formatReviewDate(), ReviewVideoCard(), ReviewVideoCardProps (+26 more)

### Community 12 - "getOrgPipelineOverrides"
Cohesion: 0.23
Nodes (14): effectiveDeepseekApiKey(), effectiveElevenLabsApiKey(), effectiveLlmProviderPreference(), effectiveOpenAiApiKey(), effectivePexelsApiKey(), getLlmModel(), getOpenAiModel(), isAiSceneImagesEnabled() (+6 more)

### Community 13 - "media-providers.ts"
Cohesion: 0.06
Nodes (59): execFileAsync, getAudioDuration(), postProcessTtsAudio(), ensureDir(), generateMedia(), blendPixel(), clampByte(), crc32() (+51 more)

### Community 14 - "Nav.tsx"
Cohesion: 0.11
Nodes (13): AUTH_PATHS, LEGAL_PATHS, Nav(), NAV_ITEMS, NavEntry, NavIcon, profileInitial(), AppNotification (+5 more)

### Community 15 - "useToast"
Cohesion: 0.05
Nodes (57): InvitePage(), ChannelDeleteButton(), DeleteChannelModal(), ChannelSwitcher(), CreateChannelForm(), GettingStartedChecklist(), GettingStartedChecklistProps, MarkClipPublishedButton() (+49 more)

### Community 16 - "retention.ts"
Cohesion: 0.18
Nodes (4): NORMAL_KEN_BURNS, RETENTION_KEN_BURNS, ChannelConfig, VideoFormat

### Community 17 - "seed.ts"
Cohesion: 0.29
Nodes (7): bindChannelPrompts(), CHANNEL_MONETIZATION_BASE, CURIOSIDADES_HISTORIA_CONFIG, FRAUDE_CORPORATIVO_CONFIG, main(), PROMPTS, TEMPLATES

### Community 18 - "video-renderer/src/index.ts"
Cohesion: 0.07
Nodes (62): applyClipOverlay(), BADGE_Y, buildThumbnailBadgeSvg(), escapeXml(), rawClipPath(), wrapTitle(), buildSubtitleSvg(), burnSubtitlesIntoClip() (+54 more)

### Community 19 - "frontend/src/lib/auth-cookie.ts"
Cohesion: 0.46
Nodes (4): GET(), authHeadersFromCookie(), getServerAuthToken(), decodeAuthCookieValue()

### Community 20 - "[locale]/layout.tsx"
Cohesion: 0.33
Nodes (3): Props, Providers(), ToastProvider()

### Community 21 - "HelpCenter.tsx"
Cohesion: 0.33
Nodes (3): HelpCenter(), HelpSection, useHelpSections()

### Community 22 - "a/[slug]/page.tsx"
Cohesion: 0.83
Nodes (3): generateMetadata(), HelpArticlePage(), getHelpArticleBySlug()

### Community 23 - "database/src/index.ts"
Cohesion: 0.09
Nodes (45): PROMPT_UPDATES, globalForPrisma, BYOK_PROVIDERS, ByokProvider, deleteByokApiKey(), deleteOrgDeepseekApiKey(), deleteOrgElevenLabsApiKey(), deleteOrgOpenAiApiKey() (+37 more)

### Community 24 - "HelpSearch.tsx"
Cohesion: 0.67
Nodes (3): HelpSearch(), SearchHit, useDebounced()

### Community 26 - "middleware/auth.ts"
Cohesion: 0.11
Nodes (28): AuthContext, getAuthSecretKey(), hashPassword(), isAdminRole(), JwtPayload, MemberRole, signToken(), verifyPassword() (+20 more)

### Community 30 - "PipelineDetailLive.tsx"
Cohesion: 0.11
Nodes (34): DashboardActivePipelines(), DashboardActivePipelinesProps, channelStepperOptions(), PipelineDetailLive(), PipelineElapsed(), PipelineProgressBar(), PipelineProgressBarProps, Filter (+26 more)

### Community 38 - "stripe-webhook.ts"
Cohesion: 0.09
Nodes (39): ACTIVE_SUBSCRIPTION_STATUSES, appendCheckoutTaxParams(), BillingStatus, claimWebhookEvent(), createBillingPortalSession(), createCheckoutSession(), fetchStripeSubscription(), isActiveStripeSubscription() (+31 more)

### Community 39 - "videos.ts"
Cohesion: 0.07
Nodes (38): paginatedResponse(), PaginatedResult, PaginationParams, parsePagination(), CANCELLABLE_VIDEO_REVIEW, cancelPipelineRun(), isPipelineCancellable(), PlanLimitError (+30 more)

### Community 40 - "SettingsPlanPanel.tsx"
Cohesion: 0.20
Nodes (12): Props, formatRenewalDate(), isAdminRole(), SettingsPlanPanel(), UPGRADE_PLAN_IDS, TrialBanner(), formatPlanLimitsSummary(), formatPlanPrice() (+4 more)

### Community 42 - "dependencies"
Cohesion: 0.05
Nodes (43): @autotube/idea-generator, @autotube/media-generator, @autotube/script-generator, dependencies, @autotube/analytics, @autotube/config, @autotube/content-scorer, @autotube/database (+35 more)

### Community 47 - "LegalArticles.tsx"
Cohesion: 0.16
Nodes (9): Props, Props, PrivacyPolicyArticle(), TermsOfServiceArticle(), LegalSectionBody(), LegalSectionDef, PRIVACY_SECTIONS, TERMS_SECTIONS (+1 more)

### Community 48 - "channels.ts"
Cohesion: 0.08
Nodes (42): buildCredentialFromEnv(), ChannelIntegrationsResponse, checkYouTubeStatus(), deleteChannelCredential(), envYouTubeData(), getChannelIntegrations(), getIntegrationsSummaryForChannels(), IntegrationProvider (+34 more)

### Community 53 - "config-system/src/index.ts"
Cohesion: 0.14
Nodes (17): AppConfig, channelConfigSchema, envSchema, GetMaxScenesOptions, LlmProviderName, ChannelProductOverrides, clearOrgPipelineOverrides(), mergeChannelProductOverrides() (+9 more)

### Community 57 - "scripts"
Cohesion: 0.05
Nodes (38): scripts, build, build:core, channel:auto-publish, clean:web, db:generate, db:migrate, db:migrate:deploy (+30 more)

### Community 58 - "shared/src/types.ts"
Cohesion: 0.09
Nodes (24): AspectRatio, ContentScoreBreakdown, MediaAssetDTO, MediaAssetType, PIPELINE_STEPS, PipelineJobPayload, PipelineStatus, PipelineStep (+16 more)

### Community 61 - "Skeleton.tsx"
Cohesion: 0.13
Nodes (9): Skeleton(), SkeletonCard(), SkeletonGrid(), SkeletonHeader(), SkeletonPanel(), SkeletonSettingsLayout(), SkeletonStats(), SkeletonTable() (+1 more)

### Community 68 - "publication-planner.ts"
Cohesion: 0.13
Nodes (31): addDaysToZonedDate(), applyRetentionFeedbackToCalendar(), buildPublicationCalendar(), clampInt(), computeNextPublishSlot(), computeShortPublishSlots(), countLongsInWeek(), DAY_NAMES_ES (+23 more)

### Community 70 - "llm/src/index.ts"
Cohesion: 0.11
Nodes (18): getActiveLlmLabel(), isLlmMockMode(), LlmClient, MOCK_BODY_FILLERS, MOCK_VISUAL_BASES, MockLlmClient, mockWordCount(), OpenAiCompatibleClient (+10 more)

### Community 73 - "analytics/src/index.ts"
Cohesion: 0.11
Nodes (25): buildSummaryFromSnapshots(), getChannelAnalytics(), getChannelAnalyticsInsights(), getChannelYouTubeAnalytics(), isRealYouTubeId(), MetricsSource, persistSnapshot(), resolveMetrics() (+17 more)

### Community 79 - "pipeline.ts"
Cohesion: 0.12
Nodes (24): buildTeaserClip(), DedicatedShortResult, generateDedicatedShort(), GenerateDedicatedShortOptions, resolveShortsCount(), SHORT_ANGLE_HINTS, worker, enqueueAfterClipSplit() (+16 more)

### Community 82 - "scripts"
Cohesion: 0.07
Nodes (29): dependencies, @autotube/config, @prisma/client, devDependencies, bcryptjs, prisma, tsx, typescript (+21 more)

### Community 88 - "youtube-publisher/src/index.ts"
Cohesion: 0.21
Nodes (22): canUseRealYouTube(), createYouTubeOAuth(), createYouTubeOAuthFromCredentials(), formatYouTubeAuthError(), hasYouTubeCredentials(), hasYouTubeCredentialsForChannel(), ResolvedYouTubeCredentials, resolveYouTubeCredentialsForChannel() (+14 more)

### Community 91 - "[locale]/page.tsx"
Cohesion: 0.13
Nodes (23): channelHasIntegration(), greetingName(), HomePage(), Props, ChannelBadge(), ChannelBadgeProps, Chip(), ChipSize (+15 more)

### Community 92 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 95 - "config-system/package.json"
Cohesion: 0.08
Nodes (25): @aws-sdk/client-s3, dependencies, @autotube/shared, @aws-sdk/client-s3, nodemailer, @types/nodemailer, zod, devDependencies (+17 more)

### Community 96 - "api/src/lib/plan-limits.ts"
Cohesion: 0.12
Nodes (25): catalogs, interpolate(), MessageTree, parseAcceptLanguage(), resolveKey(), resolveLocale(), t(), assertOrgCanPublish() (+17 more)

### Community 97 - "resolve-settings.ts"
Cohesion: 0.14
Nodes (22): getMaxScenes(), getMinScenes(), loadEffectiveConfig(), PRODUCT_DEFAULTS, ProductImageQuality, ProductTtsProvider, IMAGE_QUALITIES, resolveGenerateAiImages() (+14 more)

### Community 105 - "routes/auth.ts"
Cohesion: 0.12
Nodes (19): clearAuthCookies(), cookieSecure(), serializeAuthCookie(), setAuthCookies(), maybeSendTrialEndingEmail(), normalizeEmailLocale(), notifyPaymentFailed(), trialReminderSent (+11 more)

### Community 106 - "analytics/package.json"
Cohesion: 0.08
Nodes (24): dependencies, @autotube/config, @autotube/database, @autotube/prompt-engine, @autotube/shared, @autotube/youtube-publisher, googleapis, devDependencies (+16 more)

### Community 107 - "idea-generator/package.json"
Cohesion: 0.08
Nodes (24): dependencies, @autotube/config, @autotube/content-scorer, @autotube/database, @autotube/llm, @autotube/prompt-engine, @autotube/shared, devDependencies (+16 more)

### Community 108 - "dependencies"
Cohesion: 0.05
Nodes (42): dependencies, @autotube/shared, geist, next, next-intl, react, react-dom, react-markdown (+34 more)

### Community 113 - "media-generator/package.json"
Cohesion: 0.09
Nodes (22): @andresaya/edge-tts, dependencies, @andresaya/edge-tts, @autotube/config, @autotube/database, @autotube/shared, openai, devDependencies (+14 more)

### Community 114 - "video-renderer/package.json"
Cohesion: 0.09
Nodes (22): @autotube/template-engine, dependencies, @autotube/config, @autotube/database, @autotube/shared, @autotube/template-engine, sharp, devDependencies (+14 more)

### Community 115 - "script-generator/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @autotube/config, @autotube/database, @autotube/llm, @autotube/prompt-engine, @autotube/shared, devDependencies, typescript (+14 more)

### Community 119 - "Reelpath SaaS — Fase 1 (multi-tenant)"
Cohesion: 0.09
Nodes (22): API, Autenticación, Backend (`.env`), Compatibilidad local, Configuración: canal > organización > defaults de código, Coste por vídeo (APIs), Frontend, Habilitar auth en producción (+14 more)

### Community 120 - "HelpHome.tsx"
Cohesion: 0.17
Nodes (12): generateMetadata(), HelpCategoryPage(), Props, HelpHome(), Crumb, HelpShell(), Crumb, HelpShellClient() (+4 more)

### Community 121 - "video-encoding.ts"
Cohesion: 0.18
Nodes (20): acquireFfmpegSlot(), execFileAsync, ffmpegGlobalArgs(), releaseFfmpegSlot(), runFfmpeg(), waitQueue, buildLanczosScaleCrop(), buildMotionScaleCrop() (+12 more)

### Community 125 - "pre-deploy-check.ts"
Cohesion: 0.19
Nodes (21): args, boolCheck(), Check, checkConfigSystem(), checkDbMigrations(), checkHealthEndpoints(), checkSmtp(), checkStripe() (+13 more)

### Community 126 - "job-queue/package.json"
Cohesion: 0.10
Nodes (20): dependencies, @autotube/config, @autotube/shared, bullmq, ioredis, devDependencies, typescript, @autotube/config (+12 more)

### Community 131 - "email.ts"
Cohesion: 0.17
Nodes (19): buildOrgInviteEmail(), buildPaymentFailedEmail(), buildPipelineCompletedEmail(), buildPipelineFailedEmail(), buildTrialEndingEmail(), buildWelcomeEmail(), emailGreeting(), EmailLocale (+11 more)

### Community 135 - "Facturación y suscripciones (Stripe)"
Cohesion: 0.10
Nodes (20): API, Cambio de plan seguro, Configuración inicial, Enforcement de límites, Estado de facturación en la organización, Facturación y suscripciones (Stripe), Idempotencia, Migración y seed (+12 more)

### Community 136 - "Reelpath — Documento de producto"
Cohesion: 0.10
Nodes (19): 1. Propuesta de valor, 2. Flujo ideal del usuario, 3. Funcionalidades actuales (inventario honesto), 4. Problemas de UX detectados, 4bis. Pulido de experiencia (julio 2026), 5. Roadmap recomendado, Contenido generado por IA (YouTube), Fase A — Coherencia de producto (esta sesión + corto plazo) (+11 more)

### Community 140 - "credential-crypto.ts"
Cohesion: 0.48
Nodes (6): decryptCredentialPayload(), encryptCredentialPayload(), EncryptedCredentialEnvelope, getEncryptionKey(), isCredentialEncryptionEnabled(), isEncryptedCredentialData()

### Community 141 - "youtube-publisher/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @autotube/config, @autotube/database, googleapis, devDependencies, typescript, @autotube/config, @autotube/database (+10 more)

### Community 145 - "shared/package.json"
Cohesion: 0.11
Nodes (18): devDependencies, typescript, vitest, exports, ./ffmpeg-runner, default, types, typescript (+10 more)

### Community 147 - "pipeline-cleanup.ts"
Cohesion: 0.20
Nodes (14): deleteChannelWithCleanup(), cleanupPipelineRunStorage(), deletePipelineRunCompletely(), deleteVideoLocalFilesOnly(), rmDirQuiet(), unlinkQuiet(), args, cleanupOrphans() (+6 more)

### Community 151 - "shared/src/index.ts"
Cohesion: 0.12
Nodes (10): YouTubeAnalyticsInsights, YouTubeAnalyticsSummary, YouTubeMetricsSource, YouTubeVideoMetrics, buildKaraokeAssForScene(), escapeAssText(), formatAssTime(), PAID_PLAN_IDS (+2 more)

### Community 155 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @autotube/analytics, @autotube/job-queue, @autotube/shared, @autotube/youtube-publisher, dotenv, express-rate-limit, helmet (+9 more)

### Community 156 - "lib/notifications.ts"
Cohesion: 0.18
Nodes (13): isDbSchemaError(), AppNotification, CreateNotificationInput, getComputedNotifications(), getOrgNotifications(), getStoredNotifications(), markAllNotificationsRead(), markNotificationRead() (+5 more)

### Community 157 - "llm/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @autotube/config, openai, devDependencies, typescript, @autotube/config, openai, typescript (+8 more)

### Community 158 - "prompt-engine/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @autotube/database, @autotube/shared, devDependencies, typescript, @autotube/database, @autotube/shared, typescript (+8 more)

### Community 159 - "template-engine/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @autotube/database, @autotube/shared, devDependencies, typescript, @autotube/database, @autotube/shared, typescript (+8 more)

### Community 165 - "sync-skills.sh"
Cohesion: 0.32
Nodes (12): clone_pinned(), ensure_tmp(), needs_sync(), restore_dot_skills_after_flutter(), safe_copy_tree(), sync-skills.sh script, sync_cursor_skills_vendor_fallback(), sync_dot_skills_vendor_fallback() (+4 more)

### Community 170 - "MarkdownArticle.tsx"
Cohesion: 0.19
Nodes (8): Callout(), CodeBlock(), CopyHeadingLink(), components, MarkdownOl(), MarkdownUl(), OlDepthContext, StepLi()

### Community 174 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, tsx, @types/bcryptjs, @types/cors, @types/express, @types/multer, typescript, vitest (+7 more)

### Community 175 - "job-queue/src/index.ts"
Cohesion: 0.25
Nodes (13): cancelPipelineJobsForRun(), createPipelineWorker(), enqueuePipeline(), EnqueuePipelineOptions, enqueuePipelineStep(), getPipelineQueue(), getQueue(), getRedisConnection() (+5 more)

### Community 176 - "content-scorer/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @autotube/shared, devDependencies, typescript, @autotube/shared, typescript, main, name (+6 more)

### Community 184 - "Despliegue de Reelpath en producción"
Cohesion: 0.13
Nodes (15): Alternativas consideradas, Archivos de infraestructura, Arquitectura en producción, Checklist de producción (GTM), Checklist del usuario (fuera del repo), Comandos útiles, Coste mensual estimado, Desarrollo local vs producción (+7 more)

### Community 185 - "UI Help"
Cohesion: 0.13
Nodes (13): Analíticas, Canal, Generación de Shorts, Guía de usuario (pública), Integraciones, Planificador automático, Planner y publicación, Publicación principal (+5 more)

### Community 186 - "Planificador de publicación (Publication Planner)"
Cohesion: 0.13
Nodes (14): Algoritmo MVP, API, Calendario — `buildPublicationCalendar()`, Configuración por canal (`ChannelConfig`), Estado actual (MVP), Estrategia recomendada (2 largos/semana + monetización), Fase 2 — Analytics feedback loop, `GET /api/channels/:id/publication-plan` (+6 more)

### Community 187 - "helpers/auth.ts"
Cohesion: 0.22
Nodes (5): ensureSessionViaApi(), loginViaApi(), registerViaApi(), registerViaApiWithToken(), setSessionToken()

### Community 188 - "HelpArticle.tsx"
Cohesion: 0.24
Nodes (10): github-slugger, HelpArticle(), HelpToc(), scrollToHeading(), TocItem, useActiveHeading(), MarkdownArticle(), HelpArticleMeta (+2 more)

### Community 189 - "help-content.ts"
Cohesion: 0.22
Nodes (13): buildHelpHome(), cache, CATEGORY_SLUGS, docsRoot(), firstHeading(), helpArticleHref(), readFileSafe(), SLUG_TO_CATEGORY (+5 more)

### Community 190 - "duration.ts"
Cohesion: 0.26
Nodes (10): buildLongDurationHint(), buildLongSceneCountHint(), formatDurationMinutes(), formatDurationRange(), getLongWordsPerSceneRange(), getMinScriptWords(), getScriptWordDeficit(), getTargetDurationMaxSec() (+2 more)

### Community 191 - "video-motion.ts"
Cohesion: 0.15
Nodes (10): MotionPreset, TransitionPreset, VideoMotionIntensity, inferMotionPreset(), INTENSITY_MULTIPLIER, MOTION_PRESETS, MotionFilterParams, pickFromHash() (+2 more)

### Community 192 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+6 more)

### Community 203 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 204 - "content-scorer/src/index.ts"
Cohesion: 0.19
Nodes (11): DURATION_RANGES, GENERIC_HOOK_PATTERNS, HOOK_POWER_WORDS, rankIdeas(), scoreAngle(), scoreHook(), scoreIdea(), scoreVideoQuality() (+3 more)

### Community 205 - "idea-generator/src/index.ts"
Cohesion: 0.30
Nodes (12): ensureSelectedIdea(), fetchTrends(), generateIdeas(), LlmIdeaItem, persistSelectedIdea(), pickGlobalBest(), RankedIdea, selectBestIdea() (+4 more)

### Community 211 - "Checklist completo (pre-deploy)"
Cohesion: 0.14
Nodes (13): 1) Variables de entorno (prod), 2) Build y tests (CI parity), 3) Smoke test servicios (docker local), 4) Endpoints de salud, Billing (si aplica), Checklist completo (pre-deploy), Checklist post-deploy, Datos: backups y retención (+5 more)

### Community 212 - "merge-i18n-extensions.mjs"
Cohesion: 0.18
Nodes (9): helpCenterExtensions, remainingExtensions, legalPrivacySections, legalTermsSections, buildLocale(), buildNested(), __dirname, extensions (+1 more)

### Community 215 - "pipeline-recovery.ts"
Cohesion: 0.37
Nodes (11): finalizePreReviewClipStep(), inferResumePayload(), isPipelineInProgress(), isPipelineStuck(), isYouTubeAlreadyPublished(), listStuckPipelines(), recoverAllStuckPipelines(), recoverPipelineRun() (+3 more)

### Community 216 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 217 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 218 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 219 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 220 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 221 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 222 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 223 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 224 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 225 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 226 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 227 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 228 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 231 - "Guía de usuario — Reelpath"
Cohesion: 0.15
Nodes (13): 10.1 Activar el planificador, 10.2 Calendario, 10. Planificador de publicación, 11. Fuente visual del vídeo, 13. Ajustes de cuenta, 14.1 Activar Shorts, 14.2 Modos de generación, 14.3 Embudo largo → Shorts (+5 more)

### Community 235 - "Emails transaccionales (Reelpath)"
Cohesion: 0.18
Nodes (7): Cifrado de tokens OAuth, Ejemplo Brevo, Emails transaccionales (Reelpath), Plantillas activas, Probar en local, Recomendación para España / UE, Variables de entorno

### Community 236 - "publication-plan.ts"
Cohesion: 0.30
Nodes (9): applyChannelPublicationPlan(), fetchChannelScheduledLongDates(), getChannelPublicationPlan(), previewNextPublishSlot(), PublicationPlanEntryWithMeta, PublicationPlanResponse, resolveChannelAutoPublishAt(), publicationPlanVideoWhere() (+1 more)

### Community 244 - "Pasos de despliegue"
Cohesion: 0.17
Nodes (12): 1. Provisionar VPS, 2. DNS, 3. Instalar Docker en el VPS, 4. Clonar el repositorio, 5. Configurar variables de entorno, 6. Google Cloud — OAuth YouTube, 6b. Analíticas YouTube (MVP), 7. Desplegar (+4 more)

### Community 253 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 254 - "Capas del sistema"
Cohesion: 0.18
Nodes (11): 1. API Gateway (`backend/api`), 2. Core Layer (`backend/core`), 3. Services (`backend/services`), 4. Worker (`worker`), 5. Frontend (`frontend`), 6. Infrastructure (`infrastructure`), Capas del sistema, Config System (+3 more)

### Community 255 - "api/package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, start, test, typecheck (+2 more)

### Community 256 - "loadConfig"
Cohesion: 0.28
Nodes (14): getOpenAiMaxTokens(), getStoragePath(), loadConfig(), validateProductionConfig(), ensureLocalFile(), getPublicMediaUrl(), getS3Client(), getStorageBackend() (+6 more)

### Community 267 - "help-search.ts"
Cohesion: 0.35
Nodes (9): GET(), getAllHelpArticles(), getHelpSearchIndex(), headingsFromMarkdown(), HelpSearchIndex, IndexedDoc, normalize(), searchHelpIndex() (+1 more)

### Community 269 - "setup-stripe-products.ts"
Cohesion: 0.29
Nodes (10): createPrice(), createProduct(), findMatchingPrice(), findProductByPlanId(), main(), REELPATH_PLANS, StripeList, StripePrice (+2 more)

### Community 277 - "Backups"
Cohesion: 0.20
Nodes (9): Backup de storage (archivos), Backups, Ejemplo de cron (VPS), Objetivo, Recomendación, Requisitos, Restore de storage (local), Scripts (+1 more)

### Community 295 - "Reelpath — Arquitectura del Sistema"
Cohesion: 0.22
Nodes (9): Evolución a microservicios, Extensibilidad: nuevos formatos de vídeo, Modelo de datos (resumen), n8n (opcional), Pipeline end-to-end, Principios de diseño, Reelpath — Arquitectura del Sistema, Seguridad y producción (+1 more)

### Community 296 - "PromptEngine"
Cohesion: 0.28
Nodes (4): interpolate(), PromptEngine, RenderedPrompt, RenderPromptOptions

### Community 297 - "devDependencies"
Cohesion: 0.22
Nodes (9): concurrently, dotenv-cli, devDependencies, concurrently, dotenv-cli, @playwright/test, typescript, typescript (+1 more)

### Community 302 - "Alertas externas (Sentry / Prometheus)"
Cohesion: 0.22
Nodes (8): Alertas externas (Sentry / Prometheus), Checklist de configuración, Checklist de dashboards, Ejemplo de `scrape_config`, Prometheus (API), Reglas de alertas (plantillas), Reglas recomendadas, Sentry (API, worker, frontend)

### Community 303 - "Política de contenido de canales"
Cohesion: 0.22
Nodes (8): Ampliar reglas, Categorías bloqueadas, Contenido generado por IA (YouTube), Fase 2, Política de contenido de canales, Qué se valida, Responsabilidad del operador, Respuesta API

### Community 304 - "tts-voices.ts"
Cohesion: 0.25
Nodes (7): EDGE_TTS_VOICES, ELEVENLABS_TTS_VOICES, getTtsVoicesForProvider(), isKnownTtsVoiceId(), OPENAI_TTS_VOICES, TtsVoiceOption, TtsVoiceProvider

### Community 306 - "verify-stripe-config.ts"
Cohesion: 0.31
Nodes (7): EXPECTED_PRICES, fail(), main(), ok(), REQUIRED_VARS, StripePrice, warn()

### Community 312 - "channel-compliance.ts"
Cohesion: 0.36
Nodes (7): assertChannelCompliance(), collectText(), COMPLIANCE_RULES, ComplianceRule, ComplianceViolation, matchRules(), validateChannelCompliance()

### Community 322 - "Conectar YouTube"
Cohesion: 0.25
Nodes (7): Conectar YouTube, Desconectar, Pasos para conectar, Problemas frecuentes, Quién puede ver tus vídeos, Si aparece «Requiere atención», Siguiente paso

### Community 323 - "Revisar y publicar"
Cohesion: 0.25
Nodes (7): Programar la publicación, Qué puedes hacer, Revisar un vídeo, Revisar y publicar, Shorts automáticos, Siguiente paso, Subir un vídeo que ya tienes

### Community 324 - "Analíticas"
Cohesion: 0.25
Nodes (7): Actualizar los datos, Analíticas, Dónde ver las métricas, Qué métricas verás, Requisitos, Si no aparecen datos, Siguiente paso

### Community 325 - "Planes y facturación"
Cohesion: 0.25
Nodes (7): Contratar o cambiar de plan, Cuando termina la prueba, Planes de pago, Planes y facturación, Prueba gratuita, Si alcanzas un límite, Siguiente paso

### Community 326 - "Solución de problemas"
Cohesion: 0.25
Nodes (7): El vídeo no aparece en Revisión, La generación falló, Las analíticas están vacías, ¿Necesitas más ayuda?, No puedo conectar YouTube, No puedo generar ni publicar, Solución de problemas

### Community 327 - "Connect YouTube"
Cohesion: 0.25
Nodes (7): Common issues, Connect YouTube, Disconnect, If you see "Requires attention", Next step, Steps to connect, Who can see your videos

### Community 328 - "Review and publish"
Cohesion: 0.25
Nodes (7): Automatic Shorts, Next step, Review a video, Review and publish, Schedule publishing, Upload a video you already have, What you can do

### Community 329 - "Analytics"
Cohesion: 0.25
Nodes (7): Analytics, If no data appears, Metrics you'll see, Next step, Refresh the data, Requirements, Where to view metrics

### Community 330 - "Plans and billing"
Cohesion: 0.25
Nodes (7): Free trial, If you hit a limit, Next step, Paid plans, Plans and billing, Subscribe or change plan, When the trial ends

### Community 331 - "Troubleshooting"
Cohesion: 0.25
Nodes (7): Analytics are empty, Can't connect YouTube, Can't generate or publish, Generation failed, Need more help?, The video doesn't appear in Review, Troubleshooting

### Community 332 - "Clip desde upload"
Cohesion: 0.25
Nodes (7): Clip desde upload, Estado, Flujo, Límites, Prueba manual, Requisitos del canal, UI

### Community 333 - "5. Conectar YouTube"
Cohesion: 0.25
Nodes (8): 5.1 Por qué conectar YouTube, 5.2 Paso a paso, 5.3 Seguridad de la conexión, 5.4 Privacidad por defecto, 5.5 Reconectar YouTube, 5.6 Analíticas no disponibles, 5.7 Desconectar, 5. Conectar YouTube

### Community 334 - "generate-app-icons.py"
Cohesion: 0.54
Nodes (7): Image, draw_icon(), lerp(), lerp_color(), main(), rounded_mask(), vertical_gradient()

### Community 335 - "srt.ts"
Cohesion: 0.36
Nodes (7): buildPhraseCuesForScene(), buildSyncedSrtFromScenes(), formatSrtTime(), serializeSrt(), splitIntoPhrases(), SrtCue, TimedScene

### Community 336 - "visual-origin.ts"
Cohesion: 0.29
Nodes (5): computeVisualOriginSummary(), SceneVisualOrigin, VisualOrigin, VisualOriginAsset, VisualOriginSummary

### Community 337 - "Reelpath"
Cohesion: 0.25
Nodes (8): Arquitectura, Diferenciadores implementados, Docker (producción VPS), Licencia, n8n (opcional), Pricing de lanzamiento, Reelpath, Variables de entorno

### Community 355 - "Empezar con Reelpath"
Cohesion: 0.29
Nodes (6): Crear tu cuenta, Dónde está cada cosa, Empezar con Reelpath, Entrar al panel, Siguiente paso, Tus primeros tres pasos

### Community 356 - "Generar un vídeo"
Cohesion: 0.29
Nodes (6): Generar un vídeo, Iniciar una generación, Límites de tu plan, Seguir el progreso, Si algo falla, Siguiente paso

### Community 357 - "Getting started with Reelpath"
Cohesion: 0.29
Nodes (6): Create your account, Getting started with Reelpath, Next step, Sign in to the dashboard, Where to find everything, Your first three steps

### Community 358 - "Generate a video"
Cohesion: 0.29
Nodes (6): Generate a video, If something fails, Next step, Start a generation, Track progress, Your plan limits

### Community 359 - "15. Preguntas frecuentes"
Cohesion: 0.29
Nodes (7): 15. Preguntas frecuentes, ¿Hay pago por vídeo suelto?, ¿Puedo tener varios canales de YouTube?, ¿Puedo usar mi propia voz?, ¿Qué pasa si cancelo la suscripción?, ¿Reelpath garantiza que el contenido sea correcto?, ¿YouTube permite contenido generado con IA?

### Community 360 - "Retención y borrado"
Cohesion: 0.29
Nodes (6): Borrado bajo demanda (org), Cron recomendado (VPS), Limpieza por retención (storage), Nota sobre S3, Objetivo, Retención y borrado

### Community 361 - "scripts/youtube-oauth.ts"
Cohesion: 0.48
Nodes (6): extractCode(), finishWithCode(), main(), promptManualCode(), SCOPES, waitForAuthCode()

### Community 362 - "package.json"
Cohesion: 0.29
Nodes (6): description, engines, node, name, private, version

### Community 363 - "workspaces"
Cohesion: 0.29
Nodes (7): workspaces, backend/api, backend/core/*, backend/services/*, frontend, packages/shared, worker

### Community 364 - "shared/src/shorts.ts"
Cohesion: 0.57
Nodes (6): expectedDedicatedOrMixedShortCount(), resolveLongShortsFromVideo(), resolveMixedShortsCounts(), resolveShortsPerVideo(), resolveSplitShortsCount(), ShortsMode

### Community 365 - "Quick Start (desarrollo local)"
Cohesion: 0.29
Nodes (7): 1. Infraestructura, 2. Dependencias y DB, 3. Pipeline demo (E2E sin Redis), 4. Stack completo, 5. Trigger vía API, Quick Start (desarrollo local), Requisitos

### Community 377 - "16. Solución de problemas"
Cohesion: 0.33
Nodes (6): 16. Solución de problemas, Analíticas vacías, El vídeo no carga en revisión, Generación fallida, Límite de plan / prueba expirada, Problemas al conectar YouTube

### Community 378 - "3. Tu cuenta y planes"
Cohesion: 0.33
Nodes (6): 3.1 ¿Hay que activar la cuenta por email?, 3.2 Plan de prueba (14 días), 3.3 Planes de pago, 3.4 Contratar o cambiar de plan, 3.5 Mensajes de límite, 3. Tu cuenta y planes

### Community 379 - "4. Crear tu primer canal"
Cohesion: 0.33
Nodes (6): 4.1 Crear canal, 4.2 Pestañas del canal, 4.3 Marca y audiencia, 4.4 Reglas de contenido, 4.5 Guion y duración, 4. Crear tu primer canal

### Community 398 - "Equipo e invitaciones"
Cohesion: 0.40
Nodes (4): Equipo e invitaciones, Invitar a alguien, Quitar a un miembro, Roles

### Community 399 - "Team and invitations"
Cohesion: 0.40
Nodes (4): Invite someone, Remove a member, Roles, Team and invitations

### Community 400 - "2. Primeros pasos"
Cohesion: 0.40
Nodes (5): 2.1 Registro, 2.2 Inicio de sesión, 2.3 Checklist del dashboard, 2.4 Navegación principal, 2. Primeros pasos

### Community 401 - "7. Revisar y publicar"
Cohesion: 0.40
Nodes (5): 7.1 Cola de revisión, 7.2 Aprobar o rechazar, 7.3 Programar la publicación, 7.4 Estados del vídeo, 7. Revisar y publicar

### Community 402 - "Ajustes de canal"
Cohesion: 0.40
Nodes (5): Ajustes de canal, Duración de vídeos largos, Guion y narrativa, Guía de contenido, Marca y audiencia

### Community 407 - "next.config.mjs"
Cohesion: 0.40
Nodes (4): __dirname, nextConfig, sentryEnabled, withNextIntl

### Community 434 - "Riesgos y limitaciones"
Cohesion: 0.50
Nodes (4): Desarrollo local, Esquema Prisma tras `git pull` (desarrollo local), Object storage S3 (opcional), Riesgos y limitaciones

### Community 435 - "6. Generar tu primer vídeo"
Cohesion: 0.50
Nodes (4): 6.1 Iniciar una generación, 6.2 Etapas del proceso, 6.3 Tiempos estimados, 6. Generar tu primer vídeo

### Community 436 - "9. Analíticas"
Cohesion: 0.50
Nodes (4): 9.1 Analíticas del canal, 9.2 Analíticas globales (Inicio), 9.3 Analíticas por vídeo, 9. Analíticas

### Community 441 - "youtube-set-thumbnail.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, extractThumbnailFromVideo(), main()

### Community 448 - "healthcheck.ts"
Cohesion: 0.67
Nodes (3): fetchJson(), HealthResponse, main()

### Community 449 - "test-email.ts"
Cohesion: 0.83
Nodes (3): emailVarsStatus(), main(), resolveRecipient()

### Community 458 - "12. Equipo e invitaciones"
Cohesion: 0.67
Nodes (3): 12.1 Invitar miembros, 12.2 Roles, 12. Equipo e invitaciones

### Community 459 - "1. Qué es Reelpath"
Cohesion: 0.67
Nodes (3): 1. Qué es Reelpath, Para quién es, Qué hace Reelpath (y qué no)

### Community 460 - "8. Subir un vídeo que ya tienes"
Cohesion: 0.67
Nodes (3): 8. Subir un vídeo que ya tienes, Pasos, Requisitos

## Knowledge Gaps
- **1165 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+1160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `t()` connect `api/src/lib/plan-limits.ts` to `seed.ts`, `help-search.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `searchHelpIndex()` connect `help-search.ts` to `api/src/lib/plan-limits.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `AppLocale` connect `translate` to `user-messages.ts`, `api.ts`, `AuthContext.tsx`, `navigation.ts`, `SettingsPlanPanel.tsx`, `videos/page.tsx`, `ChannelDetailTabs.tsx`, `videos/[id]/page.tsx`, `help-content.ts`, `PipelineDetailLive.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `translate` be split into smaller, more focused modules?**
  _Cohesion score 0.06393442622950819 - nodes in this community are weakly interconnected._
- **Should `api/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0960591133004926 - nodes in this community are weakly interconnected._
- **Should `user-messages.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13230769230769232 - nodes in this community are weakly interconnected._
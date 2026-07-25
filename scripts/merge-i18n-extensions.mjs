#!/usr/bin/env node
/**
 * Fusiona extensiones i18n en messages/es.json y messages/en.json.
 * Ejecutar: node scripts/merge-i18n-extensions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remainingExtensions } from './i18n-remaining-extensions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'frontend', 'messages');

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = target[key] && typeof target[key] === 'object' ? target[key] : {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const extensions = {
  common: {
    loading: { es: 'Cargando…', en: 'Loading…' },
    saving: { es: 'Guardando…', en: 'Saving…' },
    saveChanges: { es: 'Guardar cambios', en: 'Save changes' },
    refresh: { es: 'Actualizar', en: 'Refresh' },
    refreshing: { es: 'Actualizando…', en: 'Refreshing…' },
    delete: { es: 'Eliminar', en: 'Delete' },
    confirm: { es: 'Confirmar', en: 'Confirm' },
    edit: { es: 'Editar', en: 'Edit' },
    download: { es: 'Descargar', en: 'Download' },
    channel: { es: 'Canal', en: 'Channel' },
    video: { es: 'Vídeo', en: 'Video' },
    duration: { es: 'Duración', en: 'Duration' },
    status: { es: 'Estado', en: 'Status' },
    details: { es: 'Detalles', en: 'Details' },
    all: { es: 'Todos', en: 'All' },
    unknown: { es: 'Desconocido', en: 'Unknown' },
    relativeDaysAgo: { es: 'Hace {count} días', en: '{count} days ago' },
    durationHours: { es: '{h} h', en: '{h} h' },
    durationMinutes: { es: '{m} min', en: '{m} min' },
    durationSeconds: { es: '{s} s', en: '{s} s' },
    paginationAria: { es: 'Paginación', en: 'Pagination' },
    previous: { es: '← Anterior', en: '← Previous' },
    next: { es: 'Siguiente →', en: 'Next →' },
    pageInfo: { es: 'Página {page} de {total}', en: 'Page {page} of {total}' },
  },
  dashboard: {
    gettingStartedTitle: { es: 'Primeros pasos', en: 'Getting started' },
    nextStepBadge: { es: 'Siguiente paso', en: 'Next step' },
    stepProgress: { es: 'Paso {current} de {total} — {completed} completado{completedSuffix}', en: 'Step {current} of {total} — {completed} completed' },
    onboardingProgressAria: { es: 'Progreso de configuración inicial', en: 'Initial setup progress' },
    stepChannelTitle: { es: 'Crea tu primer canal', en: 'Create your first channel' },
    stepChannelDesc: { es: 'Define el nombre y el nicho de contenido que quieres producir.', en: 'Set the name and content niche you want to produce.' },
    stepIntegrationsTitle: { es: 'Conecta YouTube', en: 'Connect YouTube' },
    stepIntegrationsDesc: { es: 'Vincula la cuenta de YouTube donde se publicará el contenido de cada canal.', en: 'Link the YouTube account where each channel will publish.' },
    stepGenerateTitle: { es: 'Genera tu primer vídeo', en: 'Generate your first video' },
    stepGenerateDesc: { es: 'La IA creará guion, voz, imágenes y vídeo listo para revisar.', en: 'AI will create script, voice, visuals, and a video ready for review.' },
    connectYoutube: { es: 'Conectar YouTube', en: 'Connect YouTube' },
    generateFirstVideo: { es: 'Genera tu primer vídeo', en: 'Generate your first video' },
    footnoteIntegrations: { es: '¿Ya tienes un canal? Abre <link>Integraciones</link> para conectar tu cuenta de YouTube.', en: 'Already have a channel? Open <link>Integrations</link> to connect your YouTube account.' },
    footnoteGenerate: { es: 'YouTube conectado. Abre tu canal y pulsa «Generar vídeo» para lanzar la primera generación.', en: 'YouTube connected. Open your channel and click «Generate video» to start your first generation.' },
    trialExpired: { es: 'Tu periodo de prueba ha expirado.', en: 'Your trial period has expired.' },
    trialDaysLeft: { es: 'Te quedan {days} días de prueba gratuita.', en: 'You have {days} days left on your free trial.' },
    viewPlans: { es: 'Ver planes', en: 'View plans' },
    upgradePlan: { es: 'Mejorar plan', en: 'Upgrade plan' },
    billingPastDue: { es: 'Hay un problema con el pago de tu suscripción.', en: 'There is a problem with your subscription payment.' },
    manageBilling: { es: 'Gestionar facturación', en: 'Manage billing' },
    globalAnalytics: { es: 'Analíticas globales', en: 'Global analytics' },
    syncingAnalytics: { es: 'Sincronizando analíticas…', en: 'Syncing analytics…' },
    loadingAnalytics: { es: 'Cargando analíticas…', en: 'Loading analytics…' },
    totalViews: { es: 'Vistas totales', en: 'Total views' },
    videosWithData: { es: 'Vídeos con datos', en: 'Videos with data' },
    syncingGenerations: { es: 'Actualizando generaciones…', en: 'Updating generations…' },
    refreshError: { es: 'No se pudo actualizar', en: 'Could not refresh' },
    topVideos: { es: 'Top vídeos', en: 'Top videos' },
  },
  channels: {
    newChannel: { es: 'Nuevo canal', en: 'New channel' },
    setupChannel: { es: 'Configura tu canal', en: 'Set up your channel' },
    nameLabel: { es: 'Nombre del canal', en: 'Channel name' },
    nicheLabel: { es: 'Nicho o temática', en: 'Niche or topic' },
    creating: { es: 'Creando…', en: 'Creating…' },
    createFirst: { es: 'Crear primer canal', en: 'Create first channel' },
    createdToast: { es: 'Canal creado', en: 'Channel created' },
    integrationReview: { es: 'Revisar', en: 'Review' },
    notConnected: { es: 'Sin conectar', en: 'Not connected' },
    inactiveToast: { es: 'El canal está inactivo. Actívalo en la configuración del canal.', en: 'This channel is inactive. Enable it in channel settings.' },
    pipelineStarted: { es: 'Generación iniciada para «{name}»', en: 'Generation started for «{name}»' },
    reviewUpToDate: { es: 'Revisión al día', en: 'Review up to date' },
    pendingReviewCount: { es: '{count} en revisión', en: '{count} in review' },
    lastPipeline: { es: 'Última gen:', en: 'Last gen:' },
    starting: { es: 'Iniciando…', en: 'Starting…' },
    tabPlanning: { es: 'Planificación', en: 'Planning' },
    tabAnalytics: { es: 'Analíticas', en: 'Analytics' },
    active: { es: 'Canal activo', en: 'Active channel' },
    inactive: { es: 'Canal inactivo', en: 'Inactive channel' },
    plannerActive: { es: 'Planner activo', en: 'Planner active' },
    plannerManual: { es: 'Planner manual', en: 'Manual planner' },
    contentSection: { es: 'Contenido y publicación', en: 'Content & publishing' },
    calendarSection: { es: 'Calendario de publicación', en: 'Publishing calendar' },
    accountsSection: { es: 'Cuentas conectadas', en: 'Connected accounts' },
    statusLabel: { es: 'Estado del canal', en: 'Channel status' },
    activeDescription: { es: 'Activo — se pueden iniciar generaciones', en: 'Active — generations can be started' },
    saveName: { es: 'Guardar nombre', en: 'Save name' },
    activatedToast: { es: 'Canal activado', en: 'Channel activated' },
    settingsSaved: { es: 'Configuración guardada', en: 'Settings saved' },
    saveSettings: { es: 'Guardar configuración', en: 'Save settings' },
    disconnectYoutube: { es: 'Desconectar YouTube', en: 'Disconnect YouTube' },
    connectYoutube: { es: 'Conectar YouTube', en: 'Connect YouTube' },
    privacyQuestion: { es: '¿Quién puede ver tus vídeos?', en: 'Who can watch your videos?' },
    delete: { es: 'Eliminar canal', en: 'Delete channel' },
    deleting: { es: 'Eliminando…', en: 'Deleting…' },
    badgeTitle: { es: 'Canal: {name}', en: 'Channel: {name}' },
    filterLabel: { es: 'Canal', en: 'Channel' },
    allChannels: { es: 'Todos los canales', en: 'All channels' },
    schedulePublish: { es: 'Programar publicación en YouTube', en: 'Schedule YouTube publication' },
    channelFallback: { es: 'Canal', en: 'Channel' },
    privacy: {
      public: { es: 'Público', en: 'Public' },
      unlisted: { es: 'No listado', en: 'Unlisted' },
      private: { es: 'Privado', en: 'Private' },
    },
    integration: {
      connected: { es: 'Conectado', en: 'Connected' },
      needsAttention: { es: 'Requiere atención', en: 'Needs attention' },
      notConnected: { es: 'No conectado', en: 'Not connected' },
      reviewSuffix: { es: '{label} · revisar', en: '{label} · review' },
      without: { es: 'Sin {label}', en: 'No {label}' },
      helpText: { es: 'Los vídeos de este canal se publicarán en esta cuenta.', en: 'This channel\'s videos will be published to this account.' },
      intro: { es: 'Conecta la cuenta de YouTube donde quieres publicar el contenido de este canal. Cada canal puede tener su propia cuenta de YouTube.', en: 'Connect the YouTube account where you want to publish this channel\'s content. Each channel can have its own YouTube account.' },
      errors: {
        sessionExpired: { es: 'La sesión con YouTube ha caducado. Pulsa Reconectar para autorizar de nuevo.', en: 'Your YouTube session has expired. Click Reconnect to authorize again.' },
        notConnected: { es: 'Esta cuenta aún no está conectada.', en: 'This account is not connected yet.' },
        unauthorized: { es: 'No tenemos permiso para publicar. Vuelve a conectar la cuenta.', en: 'We don\'t have permission to publish. Reconnect the account.' },
        generic: { es: 'Hay un problema con la conexión a YouTube. Pulsa Reconectar o contacta al administrador.', en: 'There is a problem with the YouTube connection. Click Reconnect or contact your administrator.' },
      },
    },
    studio: {
      controlRoom: { es: 'Sala de control', en: 'Control room' },
      topic: { es: 'Tema', en: 'Topic' },
      production: { es: 'Producción', en: 'Production' },
      review: { es: 'Revisión', en: 'Review' },
    },
    uploadLong: {
      title: { es: 'Subir vídeo largo', en: 'Upload long video' },
      success: { es: 'Vídeo subido correctamente', en: 'Video uploaded successfully' },
      uploading: { es: 'Subiendo…', en: 'Uploading…' },
      selectFile: { es: 'Seleccionar archivo', en: 'Select file' },
    },
  },
  videos: {
    notFound: { es: 'Vídeo no encontrado', en: 'Video not found' },
    noAccess: { es: 'Sin acceso a este vídeo', en: 'No access to this video' },
    viewDetail: { es: 'Ver detalle y clips', en: 'View detail and clips' },
    optionsAria: { es: 'Opciones de {title}', en: 'Options for {title}' },
    filterAria: { es: 'Filtrar por estado', en: 'Filter by status' },
    searchPlaceholder: { es: 'Buscar por título o descripción…', en: 'Search by title or description…' },
    searchAria: { es: 'Buscar vídeos', en: 'Search videos' },
    unscheduled: { es: 'Sin programar', en: 'Not scheduled' },
    noDateAssigned: { es: 'Aún no tiene fecha de publicación asignada.', en: 'No publication date assigned yet.' },
    metadataSaved: { es: 'Metadatos guardados', en: 'Metadata saved' },
    format: {
      long: { es: 'Largo', en: 'Long' },
      short: { es: 'Short', en: 'Short' },
    },
    status: {
      published: { es: 'Publicado', en: 'Published' },
      scheduledYoutube: { es: 'Programado en YouTube', en: 'Scheduled on YouTube' },
      schedulingYoutube: { es: 'Programando en YouTube…', en: 'Scheduling on YouTube…' },
    },
    edit: {
      title: { es: 'Título', en: 'Title' },
      description: { es: 'Descripción', en: 'Description' },
      tags: { es: 'Tags (separados por coma)', en: 'Tags (comma-separated)' },
    },
    player: {
      loadError: { es: 'No se pudo cargar el vídeo. Comprueba tu conexión o inténtalo de nuevo.', en: 'Could not load the video. Check your connection or try again.' },
      localDeleted: { es: 'Archivo local eliminado. El vídeo sigue disponible en YouTube.', en: 'Local file deleted. The video is still available on YouTube.' },
      positionAria: { es: 'Posición de reproducción', en: 'Playback position' },
    },
    analytics: {
      title: { es: 'Analíticas del vídeo', en: 'Video analytics' },
      tooltip: { es: 'Métricas del vídeo sincronizadas desde YouTube para revisar rendimiento tras la publicación.', en: 'Video metrics synced from YouTube to review performance after publishing.' },
    },
    maintenance: {
      regenerateThumbnail: { es: 'Regenerar miniatura', en: 'Regenerate thumbnail' },
      regenerateShorts: { es: 'Regenerar Shorts', en: 'Regenerate Shorts' },
      freeStorage: { es: 'Liberar espacio en servidor', en: 'Free server storage' },
    },
    shorts: {
      title: { es: 'YouTube Shorts', en: 'YouTube Shorts' },
      empty: { es: 'Aún no hay Shorts para este vídeo.', en: 'No Shorts for this video yet.' },
      mixedTitle: { es: 'Shorts / Teasers promocionales', en: 'Shorts / Promotional teasers' },
      dedicatedTitle: { es: 'Teasers promocionales', en: 'Promotional teasers' },
    },
    clips: {
      download: { es: 'Descargar', en: 'Download' },
      thumbnail: { es: 'Miniatura', en: 'Thumbnail' },
      kind: {
        cutFromLong: { es: 'Corte del largo', en: 'Cut from long-form' },
        cutFromLongN: { es: 'Corte {n}/{total} del largo', en: 'Cut {n}/{total} from long-form' },
        teaser: { es: 'Teaser promocional', en: 'Promotional teaser' },
        partN: { es: 'Parte {n} del largo', en: 'Part {n} from long-form' },
        vertical: { es: 'Short vertical', en: 'Vertical Short' },
      },
    },
    republish: {
      retry: { es: 'Reintentar publicación en YouTube', en: 'Retry YouTube publishing' },
      publish: { es: 'Publicar en YouTube', en: 'Publish to YouTube' },
    },
    detail: {
      generation: { es: 'Generación', en: 'Generation' },
      youtube: { es: 'YouTube', en: 'YouTube' },
      tools: { es: 'Herramientas', en: 'Tools' },
      editMetadata: { es: 'Editar metadatos', en: 'Edit metadata' },
    },
  },
  review: {
    cardEyebrow: { es: 'Revisión previa a publicar', en: 'Pre-publish review' },
    rejectTitle: { es: '¿Rechazar este vídeo?', en: 'Reject this video?' },
    approveSchedule: { es: 'Aprobar y programar', en: 'Approve and schedule' },
    publishNow: { es: 'Publicar ahora', en: 'Publish now' },
    rejectDelete: { es: 'Rechazar y eliminar', en: 'Reject and delete' },
    deleting: { es: 'Eliminando…', en: 'Deleting…' },
    scheduledCelebration: { es: '¡Vídeo programado!', en: 'Video scheduled!' },
    approvedCelebration: { es: '¡Vídeo aprobado!', en: 'Video approved!' },
    qualityReport: {
      title: { es: 'Informe de revisión automática', en: 'Auto-review report' },
      approved: { es: 'Aprobado por revisión automática', en: 'Approved by auto-review' },
      quality: { es: 'Control de calidad del vídeo', en: 'Video quality check' },
    },
    scheduleModal: {
      title: { es: 'Programar publicación', en: 'Schedule publication' },
      publishNow: { es: 'Publicar ahora', en: 'Publish now' },
      chooseDate: { es: 'Elegir fecha manual', en: 'Choose date manually' },
      usePlanner: { es: 'Usar planificador automático', en: 'Use automatic planner' },
      confirm: { es: 'Confirmar programación', en: 'Confirm schedule' },
      cancel: { es: 'Cancelar', en: 'Cancel' },
    },
    scriptEditor: {
      title: { es: 'Editor de guion', en: 'Script editor' },
      hook: { es: 'Gancho (hook)', en: 'Hook' },
      scene: { es: 'Escena {n}', en: 'Scene {n}' },
      regenerate: { es: 'Regenerar', en: 'Regenerate' },
      save: { es: 'Guardar guion', en: 'Save script' },
    },
    toast: {
      scheduled: { es: 'Vídeo programado para publicación', en: 'Video scheduled for publication' },
      approved: { es: 'Vídeo aprobado', en: 'Video approved' },
      rejected: { es: 'Vídeo rechazado y eliminado', en: 'Video rejected and deleted' },
      error: { es: 'No se pudo completar la acción', en: 'Could not complete the action' },
    },
  },
  pipelines: {
    unknownChannel: { es: 'Canal desconocido', en: 'Unknown channel' },
    emptyCategory: { es: 'No hay generaciones en esta categoría', en: 'No generations in this category' },
    emptyCategoryDesc: { es: 'Prueba otro filtro o inicia una nueva generación desde un canal.', en: 'Try another filter or start a new generation from a channel.' },
    untitled: { es: 'Generación sin título', en: 'Untitled generation' },
    retry: { es: 'Reintentar generación', en: 'Retry generation' },
    retrying: { es: 'Reintentando…', en: 'Retrying…' },
    cancel: { es: 'Cancelar generación', en: 'Cancel generation' },
    cancelling: { es: 'Cancelando…', en: 'Cancelling…' },
    resume: { es: 'Reanudar generación', en: 'Resume generation' },
    resuming: { es: 'Reanudando…', en: 'Resuming…' },
    stats: {
      inProgress: { es: 'En producción', en: 'In production' },
      completed: { es: 'Completadas', en: 'Completed' },
      failed: { es: 'Con error', en: 'Failed' },
      summaryAria: { es: 'Resumen de generaciones', en: 'Generations summary' },
    },
    detail: {
      process: { es: 'Proceso de producción', en: 'Production process' },
      preview: { es: 'Vista previa', en: 'Preview' },
      inProgress: { es: 'En curso', en: 'In progress' },
    },
    steps: {
      generate_ideas: { es: 'Generar ideas', en: 'Generate ideas' },
      select_idea: { es: 'Seleccionar idea', en: 'Select idea' },
      generate_script: { es: 'Generar guion', en: 'Generate script' },
      generate_media: { es: 'Generar imágenes y audio', en: 'Generate images and audio' },
      render_video: { es: 'Renderizar vídeo largo', en: 'Render long video' },
      auto_review: { es: 'Revisión automática', en: 'Auto review' },
      await_review: { es: 'Esperar revisión', en: 'Await review' },
      publish: { es: 'Publicar YouTube', en: 'Publish to YouTube' },
      split_shorts: { es: 'Dividir clips verticales', en: 'Split vertical clips' },
      generate_short: { es: 'Generar Shorts dedicados', en: 'Generate dedicated Shorts' },
      publish_youtube_shorts: { es: 'Publicar YouTube Shorts', en: 'Publish YouTube Shorts' },
      sync_analytics: { es: 'Sincronizar analytics', en: 'Sync analytics' },
      optimize_prompts: { es: 'Optimizar prompts', en: 'Optimize prompts' },
      cutShort: { es: 'Cortar Short del largo', en: 'Cut Short from long-form' },
      cutShortN: { es: 'Cortar {n} partes del largo', en: 'Cut {n} parts from long-form' },
      generateTeasers: { es: 'Generar teasers promocionales', en: 'Generate promotional teasers' },
      generateTopicTeasers: { es: 'Generar teasers del tema', en: 'Generate topic teasers' },
    },
  },
  settings: {
    account: {
      title: { es: 'Mi cuenta', en: 'My account' },
      displayName: { es: 'Nombre visible', en: 'Display name' },
      emailReadonly: { es: 'El email no se puede cambiar.', en: 'Email cannot be changed.' },
      currentPassword: { es: 'Contraseña actual', en: 'Current password' },
      newPassword: { es: 'Nueva contraseña', en: 'New password' },
      saveProfile: { es: 'Guardar perfil', en: 'Save profile' },
      profileSaved: { es: 'Perfil actualizado', en: 'Profile updated' },
      passwordChanged: { es: 'Contraseña actualizada', en: 'Password updated' },
    },
    team: {
      title: { es: 'Equipo', en: 'Team' },
      invite: { es: 'Invitar', en: 'Invite' },
      pendingInvites: { es: 'Invitaciones pendientes', en: 'Pending invitations' },
      members: { es: 'Miembros', en: 'Members' },
      roleOwner: { es: 'Propietario', en: 'Owner' },
      roleAdmin: { es: 'Administrador', en: 'Admin' },
      roleMember: { es: 'Miembro', en: 'Member' },
      inviteSent: { es: 'Invitación enviada', en: 'Invitation sent' },
      removeMember: { es: 'Eliminar miembro', en: 'Remove member' },
    },
    apikeys: {
      title: { es: 'API de IA (BYOK)', en: 'AI API (BYOK)' },
      saveKey: { es: 'Guardar clave', en: 'Save key' },
      keySaved: { es: 'Clave guardada', en: 'Key saved' },
    },
    plan: {
      current: { es: 'Plan actual', en: 'Current plan' },
      title: { es: 'Plan', en: 'Plan' },
      description: { es: 'Tu suscripción y límites de uso actuales.', en: 'Your subscription and current usage limits.' },
      paymentPending: { es: 'Pago pendiente', en: 'Payment pending' },
      trialExpired: { es: 'Prueba expirada', en: 'Trial expired' },
      changePlan: { es: 'Cambiar plan', en: 'Change plan' },
      manageBilling: { es: 'Gestionar facturación', en: 'Manage billing' },
      unlimitedChannels: { es: 'Canales ilimitados', en: 'Unlimited channels' },
      unlimitedVideos: { es: 'Vídeos ilimitados al mes', en: 'Unlimited videos per month' },
      unlimitedSummary: { es: 'Canales y vídeos ilimitados', en: 'Unlimited channels and videos' },
      channelCount: { es: '{count} canal', en: '{count} channel' },
      channelsCount: { es: '{count} canales', en: '{count} channels' },
      videosPerMonth: { es: '{count} vídeos al mes', en: '{count} videos per month' },
      videosPerMonthShort: { es: '{count} vídeos/mes', en: '{count} videos/mo' },
      pipelinesPerDay: { es: '{count} generaciones al día', en: '{count} generations per day' },
      trialDays: { es: '{count} días de prueba', en: '{count}-day trial' },
      noLimitsConfigured: { es: 'Sin límites configurados', en: 'No limits configured' },
      free: { es: 'Gratis', en: 'Free' },
    },
    billing: {
      paymentSuccess: { es: 'Pago completado. Tu plan se ha actualizado.', en: 'Payment completed. Your plan has been updated.' },
      paymentCancelled: { es: 'El pago se canceló. No se ha realizado ningún cargo.', en: 'Payment was cancelled. No charge was made.' },
    },
    publication: {
      title: { es: 'Publicación', en: 'Publishing' },
      connectedAccounts: { es: 'Cuentas conectadas', en: 'Connected accounts' },
    },
  },
  help: {
    openFab: { es: 'Abrir ayuda', en: 'Open help' },
    homeTitle: { es: 'Centro de ayuda', en: 'Help center' },
    categories: { es: 'Categorías', en: 'Categories' },
    missingSomething: { es: '¿Te falta algo?', en: 'Missing something?' },
    searchPlaceholder: { es: 'Buscar en la ayuda…', en: 'Search help…' },
    searchResults: { es: 'Resultados de búsqueda', en: 'Search results' },
    noResults: { es: 'Sin resultados', en: 'No results' },
    tocTitle: { es: 'En esta página', en: 'On this page' },
    expandToc: { es: 'Expandir índice', en: 'Expand table of contents' },
    shellNav: { es: 'Navegación de ayuda', en: 'Help navigation' },
    showMenu: { es: 'Mostrar menú', en: 'Show menu' },
    breadcrumb: { es: 'Breadcrumb', en: 'Breadcrumb' },
    quickActions: { es: 'Acciones rápidas', en: 'Quick actions' },
    defaultDescription: { es: 'Guía paso a paso.', en: 'Step-by-step guide.' },
    category: {
      empezar: { es: 'Empezar', en: 'Getting started' },
      youtube: { es: 'YouTube', en: 'YouTube' },
      generacion: { es: 'Generación', en: 'Generation' },
      publicacion: { es: 'Publicación', en: 'Publishing' },
      analiticas: { es: 'Analíticas', en: 'Analytics' },
      planes: { es: 'Planes', en: 'Plans' },
      equipo: { es: 'Equipo', en: 'Team' },
      troubleshooting: { es: 'Problemas', en: 'Troubleshooting' },
    },
    categoryDesc: {
      empezar: { es: 'Crea tu cuenta y completa los primeros pasos.', en: 'Create your account and complete the first steps.' },
      youtube: { es: 'Conecta tu canal y configura la visibilidad.', en: 'Connect your channel and set visibility.' },
      generacion: { es: 'Crea vídeos con un clic y sigue el progreso.', en: 'Create videos in one click and track progress.' },
      publicacion: { es: 'Revisa, aprueba y programa tus vídeos.', en: 'Review, approve, and schedule your videos.' },
      analiticas: { es: 'Consulta vistas, retención y rendimiento.', en: 'View watch time, retention, and performance.' },
      planes: { es: 'Prueba gratuita, suscripción y límites.', en: 'Free trial, subscription, and limits.' },
      equipo: { es: 'Invita colaboradores y asigna roles.', en: 'Invite collaborators and assign roles.' },
      troubleshooting: { es: 'Soluciones a los errores más habituales.', en: 'Solutions to common errors.' },
    },
    quick: {
      connectYoutube: { es: 'Conectar YouTube', en: 'Connect YouTube' },
      connectYoutubeDesc: { es: 'Vincula tu canal en 3 minutos', en: 'Link your channel in 3 minutes' },
      publish: { es: 'Publicar', en: 'Publish' },
      publishDesc: { es: 'Revisa y sube a YouTube', en: 'Review and upload to YouTube' },
      analytics: { es: 'Analíticas', en: 'Analytics' },
      analyticsDesc: { es: 'Mide el rendimiento de tus vídeos', en: 'Measure your video performance' },
      plans: { es: 'Planes', en: 'Plans' },
      plansDesc: { es: 'Prueba, límites y suscripción', en: 'Trial, limits, and subscription' },
    },
  },
  errors: {
    pageErrorCode: { es: 'Algo falló', en: 'Something went wrong' },
    pageErrorTitle: { es: 'No pudimos cargar esta página', en: 'We couldn\'t load this page' },
    pageErrorDesc: { es: 'Ha ocurrido un error inesperado. Puedes reintentar ahora mismo; si vuelve a pasar, prueba de nuevo en unos minutos.', en: 'An unexpected error occurred. You can retry now; if it happens again, try again in a few minutes.' },
    globalTitle: { es: 'Ha ocurrido un error', en: 'An error occurred' },
    globalDesc: { es: 'Hemos registrado el problema. Recarga la página o vuelve al inicio.', en: 'We\'ve logged the issue. Reload the page or go back home.' },
    serverError: { es: 'Error del servidor', en: 'Server error' },
  },
  api: {
    serviceUnavailable: { es: 'El servicio no está disponible. Inténtalo de nuevo en unos minutos.', en: 'The service is unavailable. Try again in a few minutes.' },
    genericError: { es: 'Algo salió mal. Inténtalo de nuevo.', en: 'Something went wrong. Try again.' },
    serviceUnavailableTitle: { es: 'Servicio no disponible', en: 'Service unavailable' },
    devInfoSummary: { es: 'Info para desarrolladores', en: 'Developer info' },
    devConnectionHint: { es: 'No se puede conectar con la API. Comprueba que el backend esté en marcha.', en: 'Cannot connect to the API. Check that the backend is running.' },
    errors: {
      channelNotFound: { es: 'Canal no encontrado', en: 'Channel not found' },
      videoNotFound: { es: 'Vídeo no encontrado', en: 'Video not found' },
      pipelineNotFound: { es: 'Generación no encontrada', en: 'Generation not found' },
      clipNotFound: { es: 'Clip no encontrado', en: 'Clip not found' },
      noVideoAccess: { es: 'No tienes acceso a este vídeo', en: 'You don\'t have access to this video' },
      sessionExpired: { es: 'Sesión expirada. Inicia sesión de nuevo.', en: 'Session expired. Sign in again.' },
      invalidCredentials: { es: 'Email o contraseña incorrectos', en: 'Incorrect email or password' },
      registrationDisabled: { es: 'El registro está deshabilitado. Contacta con el administrador.', en: 'Registration is disabled. Contact your administrator.' },
      channelInactive: { es: 'El canal está inactivo. Actívalo en la configuración del canal.', en: 'This channel is inactive. Enable it in channel settings.' },
      retryFailedOnly: { es: 'Solo se pueden reintentar generaciones fallidas', en: 'Only failed generations can be retried' },
      trialExpired: { es: 'Tu periodo de prueba ha expirado. Mejora tu plan para seguir generando y publicando vídeos.', en: 'Your trial has expired. Upgrade your plan to keep generating and publishing videos.' },
      orgInactive: { es: 'Tu organización está inactiva. Contacta con soporte.', en: 'Your organization is inactive. Contact support.' },
      orgNotFound: { es: 'Organización no encontrada', en: 'Organization not found' },
      pipelineDailyLimit: { es: 'Has alcanzado el límite de {limit} generaciones diarias de tu plan. Mejora de plan para continuar.', en: 'You\'ve reached your plan\'s daily limit of {limit} generations. Upgrade to continue.' },
      videoMonthlyLimit: { es: 'Has alcanzado el límite de {limit} vídeos este mes. Mejora de plan para generar más.', en: 'You\'ve reached your plan\'s monthly limit of {limit} videos. Upgrade to generate more.' },
      adminRequired: { es: 'Se requiere rol de administrador', en: 'Administrator role required' },
      noOrg: { es: 'Usuario sin organización asignada', en: 'User has no assigned organization' },
      userNotFound: { es: 'Usuario no encontrado', en: 'User not found' },
      emailTaken: { es: 'El email ya está registrado', en: 'Email is already registered' },
      registrationDisabledShort: { es: 'Registro deshabilitado', en: 'Registration disabled' },
      wrongPassword: { es: 'La contraseña actual es incorrecta', en: 'Current password is incorrect' },
      noChanges: { es: 'No hay cambios que guardar', en: 'No changes to save' },
      passwordRequired: { es: 'La contraseña actual es obligatoria', en: 'Current password is required' },
      inviteWrongEmail: { es: 'La invitación es para otro email', en: 'This invitation is for a different email' },
      maxChannels: { es: 'Tu plan permite un máximo de {limit} canales. Mejora de plan para crear más.', en: 'Your plan allows a maximum of {limit} channels. Upgrade to create more.' },
    },
    pipelineErrors: {
      youtubeDisconnected: { es: 'YouTube desconectado', en: 'YouTube disconnected' },
      somethingWrong: { es: 'Algo salió mal', en: 'Something went wrong' },
      sessionExpired: { es: 'La sesión con YouTube ha caducado o fue revocada. Ve a Integraciones de tu canal y conecta YouTube de nuevo.', en: 'Your YouTube session has expired or was revoked. Go to your channel Integrations and reconnect YouTube.' },
      uploadConflict: { es: 'La subida a YouTube se interrumpió o hubo un conflicto. Usa «Reintentar publicación en YouTube» en la ficha del vídeo.', en: 'The YouTube upload was interrupted or conflicted. Use «Retry YouTube publishing» on the video page.' },
      notConnected: { es: 'YouTube no está conectado para este canal. Ve a Integraciones del canal y conecta tu cuenta.', en: 'YouTube is not connected for this channel. Go to channel Integrations and connect your account.' },
      teaserFailed: { es: 'No se pudo generar un teaser promocional válido. El sistema reintentará con un gancho corregido; si persiste, revisa el guion del vídeo largo.', en: 'Could not generate a valid promotional teaser. The system will retry with a corrected hook; if it persists, review the long video script.' },
    },
  },
  auth: {
    loginOrgDescription: { es: 'Accede a tu organización en Reelpath', en: 'Access your organization on Reelpath' },
    registerOrgDescription: { es: 'Crea tu organización en Reelpath', en: 'Create your organization on Reelpath' },
    inviteTitle: { es: 'Invitación al equipo', en: 'Team invitation' },
    inviteSubtitle: { es: 'Únete a una organización en Reelpath', en: 'Join an organization on Reelpath' },
    inviteProcessing: { es: 'Procesando invitación…', en: 'Processing invitation…' },
    inviteAccepted: { es: 'Invitación aceptada. Redirigiendo a ajustes…', en: 'Invitation accepted. Redirecting to settings…' },
    inviteAcceptError: { es: 'No se pudo aceptar la invitación', en: 'Could not accept invitation' },
  },
  components: {
    theme: {
      enableLight: { es: 'Activar modo claro', en: 'Enable light mode' },
      enableDark: { es: 'Activar modo oscuro', en: 'Enable dark mode' },
      light: { es: 'Modo claro', en: 'Light mode' },
      dark: { es: 'Modo oscuro', en: 'Dark mode' },
    },
    notifications: {
      title: { es: 'Notificaciones', en: 'Notifications' },
      count: { es: '{count} notificaciones', en: '{count} notifications' },
      loadError: { es: 'No se pudieron cargar las notificaciones.', en: 'Could not load notifications.' },
      empty: { es: 'Sin notificaciones', en: 'No notifications' },
    },
  },
  emails: {
    greeting: { es: 'Hola,', en: 'Hi,' },
    greetingName: { es: 'Hola {name},', en: 'Hi {name},' },
    pipelineCompleted: {
      subject: { es: 'Tu vídeo «{title}» está listo para revisar', en: 'Your video «{title}» is ready for review' },
      body: { es: 'La generación en «{channel}» ha terminado.', en: 'Generation on «{channel}» has finished.' },
      cta: { es: 'Revisar vídeo', en: 'Review video' },
    },
    trialEnding: {
      subject: { es: 'Tu prueba de Reelpath termina en {days} día{daysSuffix}', en: 'Your Reelpath trial ends in {days} day{daysSuffix}' },
      body: { es: 'Te quedan {days} días de prueba gratuita en Reelpath.', en: 'You have {days} days left on your free Reelpath trial.' },
      cta: { es: 'Ver planes y facturación', en: 'View plans and billing' },
    },
    paymentFailed: {
      subject: { es: 'Acción requerida: problema con tu pago en Reelpath', en: 'Action required: payment issue on Reelpath' },
      body: { es: 'No hemos podido cobrar tu suscripción. Actualiza el método de pago para seguir generando vídeos.', en: 'We couldn\'t charge your subscription. Update your payment method to keep generating videos.' },
      cta: { es: 'Ir a facturación', en: 'Go to billing' },
    },
    orgInvite: {
      subject: { es: 'Invitación a unirte a «{org}» en Reelpath', en: 'Invitation to join «{org}» on Reelpath' },
      body: { es: '{inviter} te ha invitado a colaborar en {org} en Reelpath.', en: '{inviter} invited you to collaborate on {org} on Reelpath.' },
      cta: { es: 'Aceptar invitación', en: 'Accept invitation' },
      inviterFallback: { es: 'Un administrador', en: 'An administrator' },
    },
    welcome: {
      subject: { es: 'Bienvenido a Reelpath', en: 'Welcome to Reelpath' },
      body: { es: 'Tu cuenta está lista. Crea un canal, conecta YouTube y lanza tu primera generación.', en: 'Your account is ready. Create a channel, connect YouTube, and launch your first generation.' },
      cta: { es: 'Ir al panel', en: 'Go to dashboard' },
    },
    pipelineFailed: {
      subject: { es: 'Generación fallida en «{channel}»', en: 'Generation failed on «{channel}»' },
      body: { es: 'La generación en «{channel}» no se completó.', en: 'Generation on «{channel}» did not complete.' },
      errorLabel: { es: 'Error:', en: 'Error:' },
      cta: { es: 'Ver detalle de la generación', en: 'View generation details' },
    },
  },
  ...remainingExtensions,
};

function buildLocale(locale) {
  const result = {};
  for (const [ns, keys] of Object.entries(extensions)) {
    result[ns] = {};
    for (const [key, value] of Object.entries(keys)) {
      if (value.es !== undefined) {
        result[ns][key] = value[locale];
      } else {
        result[ns][key] = buildNested(value, locale);
      }
    }
  }
  return result;
}

function buildNested(obj, locale) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value.es !== undefined) {
      result[key] = value[locale];
    } else {
      result[key] = buildNested(value, locale);
    }
  }
  return result;
}

for (const locale of ['es', 'en']) {
  const file = path.join(root, `${locale}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ext = buildLocale(locale);
  const merged = deepMerge(current, ext);
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Updated ${locale}.json`);
}

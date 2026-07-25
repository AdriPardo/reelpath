import rateLimit from 'express-rate-limit';

/** Límite en login/registro para frenar fuerza bruta. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

/** Límite en disparo de pipelines por IP. */
export const pipelineTriggerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de generación. Espera un momento.' },
});

# Emails transaccionales (Reelpath)

Reelpath envía emails transaccionales mínimos vía **SMTP genérico** (nodemailer) o stub en desarrollo.

## Recomendación para España / UE

Para un SaaS en español con volumen moderado, **Brevo (ex-Sendinblue)** suele ser la opción más práctica:

| Proveedor | Cuándo usarlo | Notas |
|-----------|---------------|-------|
| **Brevo** | Recomendado para empezar | Gratis ~300 emails/día, SMTP simple, buena entregabilidad en España/EU |
| **Amazon SES** | Escala y coste bajo | Muy barato a volumen; requiere verificar dominio y salir del sandbox |
| **Mailgun / SendGrid** | SMTP estándar | Alternativas maduras si ya tienes cuenta |
| **Google Workspace** | Solo pruebas | No ideal para producción SaaS (límites y políticas) |

> **Nota:** Resend no es la opción principal documentada aquí; SMTP estándar te permite cambiar de proveedor sin tocar código.

## Variables de entorno

```env
# SMTP — ejemplo Brevo (smtp-relay.brevo.com)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu-login-smtp@brevo.com
SMTP_PASS=xsmtpsib-...
SMTP_SECURE=false
EMAIL_FROM=Reelpath <noreply@tudominio.com>
```

- `SMTP_SECURE=true` para puerto **465** (SSL implícito).
- Puerto **587** con STARTTLS: `SMTP_SECURE=false` (por defecto).

Sin `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`, el servicio **no envía** correos reales: escribe un log JSON en stdout (`event: email.stub`).

## Ejemplo Brevo

1. Crea cuenta en [brevo.com](https://www.brevo.com).
2. Verifica tu dominio (o usa el remitente de prueba).
3. SMTP → credenciales: copia login y clave SMTP.
4. Añade al `.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=7a1b2c3d4e@smtp-brevo.com
SMTP_PASS=xsmtpsib-xxxxxxxx
SMTP_SECURE=false
EMAIL_FROM=Reelpath <noreply@tudominio.com>
```

## Plantillas activas

| Evento | Cuándo se dispara | Plantilla |
|--------|-------------------|-----------|
| Pipeline completado | Vídeo listo para revisión (`pending_review`) | `pipeline_completed` |
| Trial 3 días | `GET /api/auth/me` con ≤3 días de prueba restantes | `trial_ending` |
| Pago fallido | Webhook Stripe `invoice.payment_failed` o `past_due` | `payment_failed` |
| Invitación a equipo | `POST /api/org/invites` (usuario no registrado) | `org_invite` |

## Probar en local

1. **Sin SMTP:** genera un vídeo y revisa logs del **worker** tras la auto-revisión (`event: email.stub`).
2. **Con Brevo:** configura las variables SMTP y un remitente verificado.
3. **Trial:** ajusta `trialEndsAt` de la org en BD a dentro de 3 días y llama `/api/auth/me`.
4. **Invitación:** `POST /api/org/invites` con `{ "email": "..." }` — en desarrollo la respuesta incluye `inviteUrl`.
5. **Pago fallido:** simula webhook Stripe o marca `billingStatus=past_due` manualmente.

## Cifrado de tokens OAuth

Los refresh tokens de YouTube se cifran en `IntegrationCredential.data` cuando existe:

```env
CREDENTIALS_ENCRYPTION_KEY=...   # mín. 32 caracteres o hex de 64 chars
```

Sin clave, los tokens se guardan en JSON plano (solo desarrollo).

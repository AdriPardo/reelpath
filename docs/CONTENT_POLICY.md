# Política de contenido de canales

Reelpath valida la configuración de cada canal al **crear** y **actualizar** para impedir nichos ilegales o dañinos.

## Qué se valida

Se analizan estos campos (y el nombre/nicho del canal):

- `niche`, `brandName`, `tone`, `targetAudience`
- `customPromptHints`, `forbiddenTopics`
- Nombre y nicho del canal en la petición

## Categorías bloqueadas

| Categoría | Ejemplos detectados |
|-----------|---------------------|
| Armas y violencia armada | armas, explosivos, firearms |
| Drogas ilegales | narcotráfico, cocaína, drug dealing |
| Odio y supremacía | discurso de odio, nazismo justificado |
| CSAM / menores | pornografía infantil, contenido sexual con menores |
| Fraude | estafas, lavado de dinero, phishing |
| Autolesión | instrucciones de suicidio, pro-anorexia |

## Respuesta API

Si hay violaciones, la API responde `422`:

```json
{
  "error": "El canal no cumple la política de contenido",
  "violations": [
    { "field": "weapons", "message": "No se permiten canales centrados en armas..." }
  ]
}
```

## Responsabilidad del operador

- Esta validación es una **capa automática básica** (palabras clave), no sustituye revisión humana ni cumplimiento legal completo.
- Los operadores deben cumplir las políticas de YouTube y la legislación aplicable (UE, España, etc.).
- Usa `forbiddenTopics` en la configuración del canal para reforzar exclusiones propias.

## Ampliar reglas

Edita `backend/api/src/lib/channel-compliance.ts` y añade patrones con mensajes en español claros.

## Contenido generado por IA (YouTube)

- Reelpath genera vídeos con LLM, TTS e imágenes sintéticas. YouTube puede **exigir** declarar contenido alterado o sintético según sus políticas.
- **Metadatos técnicos:** las imágenes de proveedor se re-exportan sin EXIF/C2PA cuando aplica. Esto no sustituye la política de disclosure de la plataforma.
- **Buenas prácticas:** revisión humana antes de publicar, voz/edición propias cuando sea posible, no prometer hechos falsos para viralidad.

## Fase 2

- Validación semántica con LLM moderación
- Revisión periódica de vídeos publicados
- Registro de auditoría de rechazos

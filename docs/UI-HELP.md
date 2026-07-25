# UI Help

Esta guía reúne la ayuda detallada que se ha retirado de la interfaz para dejar los paneles más limpios. En la UI, los campos clave muestran un icono `i` con una explicación corta; aquí queda la referencia completa.

## Guía de usuario (pública)

Para documentación orientada al usuario final — registro, planes, YouTube, generación, revisión, Shorts, analíticas y solución de problemas — consulta:

- **[Guía maestra](./GUIA-USUARIO.md)** — documento completo listo para publicar en reelpath.io/help
- **[Artículos cortos](./AYUDA/)** — guías por tema (`01-empezar.md` … `06-planes.md`)
- **Centro de ayuda en la app** — `/ayuda` (componente `HelpCenter.tsx` con secciones colapsables)

Esta referencia (`UI-HELP.md`) complementa la guía de usuario con detalle de campos de configuración avanzada del canal.

## Ajustes de canal

### Marca y audiencia

- `Nombre de marca`: referencia editorial que ayuda a mantener consistencia en títulos, tono y framing del canal.
- `Tono narrativo`: define la voz general del contenido, por ejemplo documental, divulgativo o casual.
- `Audiencia objetivo`: describe para quién se genera el canal, qué intereses tiene y qué espera encontrar. Este contexto ayuda a la IA a ajustar enfoque y profundidad.

### Guía de contenido

- `Temas prohibidos`: lista de asuntos que deben excluirse de ideas, guiones y enfoques narrativos.
- `Instrucciones para la IA`: reglas editoriales, prioridades y restricciones adicionales para la generación.
- `Aviso legal / disclaimer`: texto opcional para incorporar un aviso fijo cuando el canal lo necesite.

### Guion y narrativa

- `Modo de generación`:
  - `Por bloques`: genera outline, secciones y ensamblado final. Suele dar más control en vídeos largos.
  - `Monolítico`: genera el guion en un solo prompt.
- `Modo retención`: prioriza hooks más fuertes al inicio, más ritmo visual y una locución algo más dinámica.

### Duración de vídeos largos

- `Duración mínima`: objetivo inferior para nuevas generaciones.
- `Duración máxima`: objetivo superior para nuevas generaciones.
- Estos valores afectan a contenido nuevo; no rehacen vídeos ya generados.

## Planner y publicación

### Planificador automático

- `Activar planificador automático`: asigna fecha y hora recomendadas al aprobar o lanzar un pipeline.
- `Zona horaria`: base sobre la que se calculan las publicaciones.
- `Máx. vídeos largos por semana`: límite semanal de publicaciones largas.
- `Hora preferida (0-23)`: hora objetivo para publicar. Como regla general, `18-20` suele ser buena franja para audiencia hispanohablante.
- `Días preferidos`: acepta varios valores separados por comas (`0=domingo`, `1=lunes`, ..., `6=sábado`).
- `Mín. días entre largos`: evita concentrar demasiadas publicaciones seguidas.

### Revisión y aprobación

- `Requiere revisión humana antes de publicar`: obliga a aprobación manual.
- `Revisión automática`: evalúa el vídeo antes de publicarlo.
- `Umbral para auto-aprobar (0-100)`: si la revisión automática está activa, el vídeo debe superar este valor para aprobarse solo.

## YouTube y Shorts

### Publicación principal

- `Publicar en YouTube al aprobar`: sube automáticamente el vídeo a la cuenta conectada.
- `Privacidad de YouTube`: fija si las nuevas publicaciones salen como públicas, no listadas o privadas.

### Generación de Shorts

- `Crear Shorts del mismo vídeo y subirlos a YouTube`: además del vídeo principal, genera piezas verticales 9:16.
- `Cómo se generan los Shorts`:
  - `Trocear el vídeo largo`: usa cortes del contenido principal.
  - `Historia dedicada`: crea teasers independientes del mismo tema.
  - `Mixto`: combina cortes del largo y teasers promocionales.
- `Partes del largo en Shorts`: cuántos cortes del vídeo principal se reutilizan.
- `Nº de Shorts por vídeo`: volumen total de Shorts que se generarán por cada vídeo largo.
- `Días entre Shorts`: escalona publicaciones. Con `0`, todos pueden salir a la vez.

## Viralidad e ideas

- `Puntuación mínima de viralidad (0 = sin filtro)`: si una idea queda por debajo del umbral, el sistema puede regenerar propuestas para intentar obtener una opción con mejor potencial.

## Analíticas

### Canal

- `YouTube Analytics`: muestra métricas sincronizadas del canal y de los vídeos publicados.
- `Vistas`: reproducciones acumuladas.
- `Tiempo de visualización`: minutos totales vistos.
- `CTR medio`: porcentaje de personas que hacen clic tras ver la miniatura o impresión.
- `Duración media`: tiempo medio visto por reproducción. La retención complementa esta métrica.

### Vídeo

- `Última sync`: fecha del último refresco de métricas.
- `Fuente`: origen del snapshot sincronizado.
- `Retención`: proporción media del vídeo que los usuarios consumen antes de abandonar.

## Integraciones

- Cada canal puede conectarse a su propia cuenta de YouTube.
- La cuenta conectada determina dónde se publican los vídeos de ese canal.
- Si faltan permisos o la sesión caduca, habrá que reconectar la cuenta para restaurar publicación y analíticas.

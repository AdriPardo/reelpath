/** Quita sintaxis markdown inline para resúmenes en texto plano. */
export function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primer párrafo del artículo (sin el título #) como lead en texto plano. */
export function articleLeadFromMarkdown(markdown: string): string {
  const withoutTitle = markdown.replace(/^\s*#\s+.+\n+/, '').trim();
  const firstBlock = withoutTitle.split(/\n\n+/)[0] ?? '';
  const paragraph = firstBlock.split('\n').find((line) => line.trim() && !/^#{1,6}\s/.test(line.trim()));
  return stripMarkdownInline(paragraph ?? '').slice(0, 200);
}

const AYUDA_LINK_MAP: Record<string, string> = {
  './01-empezar.md': '/ayuda/a/empezar',
  './02-youtube.md': '/ayuda/a/youtube',
  './03-generar-video.md': '/ayuda/a/generar-video',
  './04-publicar.md': '/ayuda/a/publicar',
  './05-analiticas.md': '/ayuda/a/analiticas',
  './06-planes.md': '/ayuda/a/planes',
  './07-problemas.md': '/ayuda/a/problemas',
  './08-equipo.md': '/ayuda/a/equipo',
  '../GUIA-USUARIO.md': '/ayuda',
};

/** Normaliza enlaces relativos .md y limpia placeholders internos. */
export function normalizeHelpMarkdown(markdown: string): string {
  let out = markdown;

  for (const [from, to] of Object.entries(AYUDA_LINK_MAP)) {
    out = out.replaceAll(`](${from})`, `](${to})`);
  }

  out = out.replace(/^\[captura:[^\]]*\]\s*$/gm, '');
  out = out.replace(/^→\s*/gm, '');

  return out.trim();
}

/** Cuerpo del artículo sin el encabezado # duplicado del header. */
export function articleBodyFromMarkdown(markdown: string): string {
  const withoutTitle = markdown.replace(/^\s*#\s+.+\n+/, '').trim();
  return normalizeHelpMarkdown(withoutTitle);
}

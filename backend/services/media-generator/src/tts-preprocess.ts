/** Normalize narration text for clearer Spanish TTS pronunciation. */
export function preprocessForTts(text: string, language = 'es'): string {
  let result = text.trim();

  result = result
    .replace(/[""«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/—|–/g, ', ')
    .replace(/…/g, '...')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[*_#`~[\]]/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s*&\s*/g, ' y ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*:\s*/g, ', ')
    .replace(/\(\s*([^)]+)\s*\)/g, ', $1, ');

  if (language.startsWith('es')) {
    result = expandHistoricalEras(result);

    const abbreviations: Array<[RegExp, string]> = [
      [/\bp\.\s*ej\./gi, 'por ejemplo,'],
      [/\bej\./gi, 'ejemplo,'],
      [/\betc\./gi, 'etcétera,'],
      [/\bvs\./gi, 'frente a'],
      [/\bIA\b/g, 'inteligencia artificial'],
      [/\bAI\b/g, 'inteligencia artificial'],
      [/\bAPI\b/g, 'interfaz de programación'],
      [/\bURL\b/g, 'dirección web'],
      [/\bGPT\b/g, 'modelo de lenguaje'],
      [/\bLLM\b/g, 'modelo de lenguaje'],
      [/\bML\b/g, 'aprendizaje automático'],
      [/\bTTS\b/g, 'voz sintética'],
      [/\bVR\b/g, 'realidad virtual'],
      [/\bAR\b/g, 'realidad aumentada'],
      [/\bUI\b/g, 'interfaz de usuario'],
      [/\bUX\b/g, 'experiencia de usuario'],
      [/\bCEO\b/g, 'director ejecutivo'],
      [/\bCTO\b/g, 'director tecnológico'],
      [/\bSaaS\b/g, 'software en la nube'],
      [/\bIoT\b/g, 'internet de las cosas'],
      [/\bWi-?Fi\b/gi, 'wifi'],
      [/\bOK\b/g, 'de acuerdo'],
      [/\bApp\b/g, 'aplicación'],
      [/\bApps\b/g, 'aplicaciones'],
      [/\bShorts\b/gi, 'vídeos cortos'],
      [/\bShort\b/gi, 'vídeo corto'],
    ];

    for (const [pattern, replacement] of abbreviations) {
      result = result.replace(pattern, replacement);
    }

    result = result.replace(/(\d+)\s*%/g, '$1 por ciento');
    result = result.replace(/(\d+)\s*€/g, '$1 euros');
    result = result.replace(/\$(\d+)/g, '$1 dólares');
    result = addSpanishPauseHints(result);
  }

  result = result.replace(/\s+/g, ' ').trim();

  if (result && !/[.!?…]$/.test(result)) {
    result += '.';
  }

  return result;
}

/** a.C. / d.C. y variantes → antes/después de Cristo (locución natural). */
export function expandHistoricalEras(text: string): string {
  let result = text;

  result = result.replace(/\bantes de cristo\b/gi, 'antes de Cristo');
  result = result.replace(/\bdespu[eé]s de cristo\b/gi, 'después de Cristo');
  result = result.replace(/\bdespues de cristo\b/gi, 'después de Cristo');

  const withYear: Array<[RegExp, string]> = [
    [/(\d+)\s*a\.?\s*de\s*C\.?/gi, '$1 antes de Cristo'],
    [/(\d+)\s*d\.?\s*de\s*C\.?/gi, '$1 después de Cristo'],
    [/(\d+)\s*a\.?\s*e\.?\s*c\.?/gi, '$1 antes de Cristo'],
    [/(\d+)\s*d\.?\s*e\.?\s*c\.?/gi, '$1 después de Cristo'],
    [/(\d+)\s*a\.?\s*C\.?/gi, '$1 antes de Cristo'],
    [/(\d+)\s*d\.?\s*C\.?/gi, '$1 después de Cristo'],
    [/(\d+)\s*A\.?\s*C\.?/gi, '$1 antes de Cristo'],
    [/(\d+)\s*D\.?\s*C\.?/gi, '$1 después de Cristo'],
    [/(\d+)\s*aC\b/gi, '$1 antes de Cristo'],
    [/(\d+)\s*dC\b/gi, '$1 después de Cristo'],
    [/(\d+)\s*B\.?\s*C\.?\b/gi, '$1 antes de Cristo'],
    [/(\d+)\s*A\.?\s*D\.?\b/gi, '$1 después de Cristo'],
  ];

  for (const [pattern, replacement] of withYear) {
    result = result.replace(pattern, replacement);
  }

  const standalone: Array<[RegExp, string]> = [
    [/\bantes de\s*J\.?\s*C\.?\b/gi, 'antes de Cristo'],
    [/\bdespu[eé]s de\s*J\.?\s*C\.?\b/gi, 'después de Cristo'],
    [/\bdespues de\s*J\.?\s*C\.?\b/gi, 'después de Cristo'],
    [/\ba\.?\s*de\s*C\.?\b/gi, 'antes de Cristo'],
    [/\bd\.?\s*de\s*C\.?\b/gi, 'después de Cristo'],
    [/\ba\.?\s*e\.?\s*c\.?\b/gi, 'antes de Cristo'],
    [/\bd\.?\s*e\.?\s*c\.?\b/gi, 'después de Cristo'],
    [/\ba\.?\s*C\.?\b/gi, 'antes de Cristo'],
    [/\bd\.?\s*C\.?\b/gi, 'después de Cristo'],
    [/\bA\.?\s*C\.?\b/g, 'antes de Cristo'],
    [/\bD\.?\s*C\.?\b/g, 'después de Cristo'],
    [/\bB\.?\s*C\.?\b/gi, 'antes de Cristo'],
    [/\bA\.?\s*D\.?\b/gi, 'después de Cristo'],
  ];

  for (const [pattern, replacement] of standalone) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/** Insert commas before conjunctions and after short intro phrases for natural pauses. */
function addSpanishPauseHints(text: string): string {
  let result = text;

  result = result.replace(
    /\b(pero|aunque|sin embargo|además|por eso|porque|mientras|cuando|si|así que)\b/gi,
    ', $1',
  );

  result = result.replace(
    /\b(Atención|Ojo|Importante|Resultado|Dato clave|En resumen|Lo cierto es)\b/gi,
    '$1,',
  );

  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\.\s*,/g, '.');
  return result;
}

import type { ScriptOutline, ScriptOutlineSection } from './types.js';

export type OutlineNormalization = {
  outline: ScriptOutline;
  adjusted: boolean;
  notes: string[];
};

function bodySceneTotal(sections: ScriptOutlineSection[]): number {
  return sections.reduce((sum, s) => sum + s.sceneCount, 0);
}

function totalWithHook(sections: ScriptOutlineSection[]): number {
  return bodySceneTotal(sections) + 1;
}

/**
 * Corrige outlines del LLM que desajustan totalScenes respecto a la suma real
 * o quedan por debajo del mínimo flexible de escenas.
 */
export function normalizeOutline(
  outline: ScriptOutline,
  minScenes: number,
  maxScenes: number,
): OutlineNormalization {
  const notes: string[] = [];
  const sections = outline.sections.map((s) => ({ ...s }));

  for (const section of sections) {
    if (section.sceneCount < 2) {
      notes.push(`Sección "${section.title}": sceneCount ${section.sceneCount} → 2`);
      section.sceneCount = 2;
    }
  }

  let total = totalWithHook(sections);

  while (total < minScenes && sections.length > 0) {
    const last = sections[sections.length - 1]!;
    last.sceneCount += 1;
    total += 1;
    notes.push(`Añadida 1 escena a "${last.title}" para alcanzar mínimo ${minScenes}`);
  }

  while (total > maxScenes && sections.length > 0) {
    const last = sections[sections.length - 1]!;
    if (last.sceneCount <= 2) break;
    last.sceneCount -= 1;
    total -= 1;
    notes.push(`Quitada 1 escena de "${last.title}" para no superar máximo ${maxScenes}`);
  }

  if (outline.totalScenes !== total) {
    notes.push(`totalScenes ${outline.totalScenes} → ${total} (1 gancho + ${bodySceneTotal(sections)} cuerpo)`);
  }

  for (let i = 0; i < sections.length - 1; i++) {
    const section = sections[i]!;
    if (!section.transitionToNext?.trim()) {
      section.transitionToNext =
        'Pero lo que descubrieron después cambiaría la forma de entender este episodio.';
      notes.push(`Añadido transitionToNext a "${section.title}"`);
    }
  }

  const lastSection = sections[sections.length - 1];
  if (lastSection?.transitionToNext?.trim()) {
    lastSection.transitionToNext = undefined;
    notes.push(`Eliminado transitionToNext de última sección "${lastSection.title}"`);
  }

  for (const section of sections) {
    if (!section.summary.trim()) {
      section.summary = `Desarrollo narrativo del bloque "${section.title}" con datos concretos y consecuencias.`;
      notes.push(`Summary generado para "${section.title}"`);
    }
  }

  return {
    outline: { ...outline, sections, totalScenes: total },
    adjusted: notes.length > 0,
    notes,
  };
}

/** Fills missing transitions and strips invalid last-section bridge without another LLM call. */
export function fixOutlineProgrammatic(outline: ScriptOutline): ScriptOutline {
  const sections = outline.sections.map((section, i, arr) => {
    const isLast = i === arr.length - 1;
    if (isLast) {
      const { transitionToNext: _drop, ...rest } = section;
      return rest;
    }
    const nextTitle = arr[i + 1]?.title ?? 'la siguiente parte';
    return {
      ...section,
      transitionToNext:
        section.transitionToNext?.trim() ||
        `Pero lo que ocurrió después en "${nextTitle}" desafió todas las expectativas.`,
    };
  });
  return { ...outline, sections };
}

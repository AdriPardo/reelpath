export interface ScriptOutlineSection {
  title: string;
  sceneCount: number;
  summary: string;
  /** Frase puente hacia el siguiente bloque (omitir en la última sección). */
  transitionToNext?: string;
}

export interface ScriptOutline {
  title: string;
  description: string;
  tags: string[];
  hookA: string;
  hookB: string;
  hookVisualPrompt: string;
  totalScenes: number;
  sections: ScriptOutlineSection[];
}

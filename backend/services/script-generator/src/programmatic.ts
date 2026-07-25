import type { ScriptScene } from '@autotube/shared';
import { LONG_SCENE_WORDS_MIN } from '@autotube/shared';
import { countWords } from './utils.js';

const PADDING_SENTENCES = [
  'Los archivos revelan detalles que durante décadas permanecieron ocultos a la vista pública.',
  'Expertos consultados coinciden en que este episodio marcó un antes y un después en la disciplina.',
  'Testimonios contemporáneos describen el momento con una precisión que sorprende a los historiadores actuales.',
  'Las consecuencias de aquel descubrimiento se extendieron mucho más allá de lo que los protagonistas imaginaron.',
  'Décadas después, nuevas excavaciones confirmaron lo que solo unos pocos se atrevieron a sostener en su momento.',
  'El contexto político y social de la época explica por qué esta historia fue silenciada durante tanto tiempo.',
];

/** Expand narration to target word count without calling the LLM (free). */
export function expandNarrationProgrammatic(narration: string, targetWords: number): string {
  let result = narration.trim();
  if (!result.endsWith('.') && !result.endsWith('?') && !result.endsWith('!')) {
    result += '.';
  }
  let i = 0;
  while (countWords(result) < targetWords && i < PADDING_SENTENCES.length * 4) {
    result += ` ${PADDING_SENTENCES[i % PADDING_SENTENCES.length]}`;
    i++;
  }
  return result.trim();
}

/** Pad short scenes in a chunk to meet minimum word counts locally. */
export function fixChunkScenesProgrammatic(
  scenes: ScriptScene[],
  expectedCount: number,
): ScriptScene[] {
  let fixed = scenes.map((s) => ({
    ...s,
    narration: expandNarrationProgrammatic(s.narration, LONG_SCENE_WORDS_MIN),
  }));

  while (fixed.length < expectedCount) {
    const idx = fixed.length;
    fixed.push({
      index: idx,
      narration: expandNarrationProgrammatic(
        `El desarrollo continúa con nuevos hallazgos que conectan con el bloque anterior.`,
        LONG_SCENE_WORDS_MIN,
      ),
      visualPrompt: `Documentary b-roll of historical artifacts and maps, detailed scene ${idx + 1}`,
      durationSec: 40,
    });
  }

  if (fixed.length > expectedCount) {
    fixed = fixed.slice(0, expectedCount);
  }

  return fixed.map((s, i) => ({ ...s, index: i }));
}

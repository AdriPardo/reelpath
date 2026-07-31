import OpenAI from 'openai';
import {
  getLlmModel,
  loadConfig,
  resolveLlmConnection,
  type LlmProviderName,
} from '@autotube/config';

export interface LlmClient {
  completeJson<T>(prompt: string, system?: string, options?: { maxTokens?: number }): Promise<T>;
}

class OpenAiCompatibleClient implements LlmClient {
  private client: OpenAI;
  private provider: LlmProviderName;
  private model: string;

  constructor(params: {
    apiKey: string;
    baseURL?: string;
    provider: LlmProviderName;
    model: string;
  }) {
    this.client = new OpenAI({
      apiKey: params.apiKey,
      ...(params.baseURL ? { baseURL: params.baseURL } : {}),
    });
    this.provider = params.provider;
    this.model = params.model;
  }

  async completeJson<T>(
    prompt: string,
    system = 'Responde SOLO JSON válido. Sé conciso.',
    options?: { maxTokens?: number },
  ): Promise<T> {
    const config = loadConfig();
    const isDeepseekV4 = this.provider === 'deepseek' && /v4|flash|pro/i.test(this.model);
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? config.OPENAI_MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      // DeepSeek V4: disable thinking for cheaper/faster JSON
      ...(isDeepseekV4 ? { thinking: { type: 'disabled' } } : {}),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    if (response.usage) {
      console.log(
        `[llm] provider=${this.provider} model=${this.model} — ${response.usage.total_tokens} tokens (in:${response.usage.prompt_tokens} out:${response.usage.completion_tokens})`,
      );
    }

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');
    return JSON.parse(content) as T;
  }
}

function mockWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const MOCK_BODY_FILLERS = [
  'Los archivos revelan detalles que durante décadas permanecieron ocultos a la vista pública.',
  'Expertos consultados coinciden en que este episodio marcó un antes y un después en la disciplina.',
  'Testimonios contemporáneos describen el momento con una precisión que sorprende a los historiadores actuales.',
  'Las consecuencias de aquel descubrimiento se extendieron mucho más allá de lo que los protagonistas imaginaron.',
  'Décadas después, nuevas excavaciones confirmaron lo que solo unos pocos se atrevieron a sostener en su momento.',
];

const MOCK_VISUAL_BASES = [
  'Aerial view of ancient Mayan pyramids rising above dense jungle canopy at golden hour',
  'Close-up of weathered stone glyphs carved into limestone temple wall with dramatic side lighting',
  'Archaeologists examining pottery shards under tent canopy in remote excavation site',
  'Drought-cracked earth surrounding abandoned plaza with empty stone benches at sunset',
  'Underground chamber lit by torchlight revealing hidden mural of celestial events',
  'Scholars comparing hand-drawn maps with satellite imagery in modern research facility',
  'Slow tracking shot along moss-covered stone aqueduct through misty mountain valley',
  'Museum curator handling fragile manuscript with cotton gloves under archival lighting',
];

class MockLlmClient implements LlmClient {
  private logged = false;

  private logMock(): void {
    if (!this.logged) {
      console.info('[llm] MOCK — sin coste API (MOCK_EXTERNAL_APIS=true o sin OPENAI_API_KEY)');
      this.logged = true;
    }
  }

  private padNarration(base: string, targetWords = 68): string {
    let result = base.trim();
    if (!result.endsWith('.')) result += '.';
    let i = 0;
    while (mockWordCount(result) < targetWords && i < MOCK_BODY_FILLERS.length * 4) {
      result += ` ${MOCK_BODY_FILLERS[i % MOCK_BODY_FILLERS.length]}`;
      i++;
    }
    return result;
  }

  private mockBodyNarration(suffix: string, isFinal = false, retention = false): string {
    const base =
      `En el verano de mil novecientos ochenta y siete, en un pequeño laboratorio de Stanford, ` +
      `un grupo de investigadores encendió por primera vez un láser de color verde que nadie creía posible. ` +
      `La comunidad científica había descartado la idea durante décadas, convencida de que las limitaciones ` +
      `del material hacían imposible ese espectro. Pero aquellos científicos demostraron que la física podía equivocarse. ` +
      `${suffix}`;
    let narration = this.padNarration(base);
    if (isFinal && retention) {
      narration = narration.replace(/\.$/, '') + ' ¿Y si lo que descubrimos mañana cambia todo lo que creíamos saber?';
    }
    return narration;
  }

  private mockVisualPrompt(index: number): string {
    const base = MOCK_VISUAL_BASES[index % MOCK_VISUAL_BASES.length]!;
    return `${base}, documentary frame ${index + 1}, unique composition`;
  }

  private mockChunkScenes(count: number, prompt: string): Array<Record<string, unknown>> {
    const retention = /modo retenci[oó]n|cliffhanger|retention/i.test(prompt);
    const isFinalChunk = /Última escena del guion|cierre memorable/i.test(prompt);
    return Array.from({ length: count }, (_, i) => {
      const isLast = i === count - 1;
      return {
        narration: this.mockBodyNarration(
          `Este hallazgo cambiaría la historia del bloque ${i + 1}.`,
          isFinalChunk && isLast,
          retention,
        ),
        visualPrompt: this.mockVisualPrompt(i + count * 3),
        durationSec: 40,
      };
    });
  }

  async completeJson<T>(prompt: string, _system?: string, _options?: { maxTokens?: number }): Promise<T> {
    this.logMock();

    if (
      prompt.includes('ideas de vídeo') ||
      prompt.includes('clave "ideas"') ||
      /"ideas"\s*:/.test(prompt)
    ) {
      return {
        ideas: [
          {
            title: '5 errores que cometes con la IA (y cómo evitarlos)',
            hook: '¿Sigues usando ChatGPT mal? Esto te cuesta horas cada día.',
            angle: 'Errores comunes de prompts y workflows',
            targetAudience: 'Creadores y profesionales tech',
            trendAlignment: 0.87,
            rationale: 'Combina dolor concreto + tendencia IA',
          },
          {
            title: 'La IA que edita vídeos sola ya está aquí',
            hook: 'En 60 segundos verás cómo un pipeline automatiza YouTube.',
            angle: 'Demo de automatización real',
            targetAudience: 'YouTubers y marketers',
            trendAlignment: 0.91,
            rationale: 'Meta-referencia al producto + demo',
          },
          {
            title: 'Por qué el 90% de los canales IA fallan',
            hook: 'No es el algoritmo. Es esto.',
            angle: 'Análisis de retención en Shorts',
            targetAudience: 'Creadores principiantes',
            trendAlignment: 0.78,
            rationale: 'Contrarian take con curiosidad',
          },
        ],
      } as T;
    }

    if (prompt.includes('Planifica la ESTRUCTURA (outline)')) {
      return {
        title: 'La IA que edita vídeos sola ya está aquí',
        description: 'Descubre cómo pipelines automatizados generan documentales con IA.',
        tags: ['IA', 'YouTube', 'automatización', 'documental', 'tech'],
        hookA: '¿Y si tu próximo vídeo se creara mientras duermes?',
        hookB: 'Nadie te cuenta cómo funciona un canal automatizado de verdad.',
        hookVisualPrompt: 'Futuristic dashboard with automated video pipeline glowing on multiple screens',
        totalScenes: 16,
        sections: [
          {
            title: 'Contexto',
            sceneCount: 4,
            summary: 'Origen del problema y primeros indicios del fenómeno.',
            transitionToNext: 'Pero lo que ocurrió después desafió todas las expectativas.',
          },
          {
            title: 'Mecanismo',
            sceneCount: 4,
            summary: 'Cómo funciona el pipeline paso a paso.',
            transitionToNext: 'Las consecuencias llegaron más rápido de lo que nadie imaginaba.',
          },
          {
            title: 'Impacto',
            sceneCount: 4,
            summary: 'Efectos en creadores, audiencia y plataforma.',
            transitionToNext: 'Hoy esa lección sigue definiendo el futuro del contenido.',
          },
          {
            title: 'Lección',
            sceneCount: 3,
            summary: 'Reflexión final y pregunta al espectador.',
          },
        ],
      } as T;
    }

    const chunkMatch = prompt.match(/EXACTAMENTE (\d+) escenas en el array "scenes"/);
    if (chunkMatch) {
      const count = Number(chunkMatch[1]);
      return { scenes: this.mockChunkScenes(count, prompt) } as T;
    }

    if (prompt.includes('Expande SOLO esta escena') || prompt.includes('escena adicional')) {
      const expanded = this.padNarration(
        'La expansión añade contexto histórico, consecuencias políticas y testimonios que enriquecen la narración.',
        72,
      );
      return {
        narration: expanded,
        visualPrompt: 'Documentary scene with researchers in modern laboratory examining archival data',
      } as T;
    }

    if (prompt.includes('escena final') || prompt.includes('Escena final')) {
      return {
        narration: this.mockBodyNarration('El cierre invita a seguir explorando el misterio.', true, true),
      } as T;
    }

    if (prompt.includes('guion TEASER') || prompt.includes('TEASER (Short')) {
      return {
        title: 'El detalle que nadie vio en este escándalo',
        description: 'Un dato imposible del caso. La historia completa en el canal.\n\n#Shorts',
        tags: ['Shorts', 'teaser', 'documental'],
        variantA: {
          hook: '¿Sabías que 2.400 millones desaparecieron en solo 48 horas?',
          scenes: [
            {
              narration: '¿Sabías que 2.400 millones desaparecieron en solo 48 horas?',
              visualPrompt: 'Shocked investor looking at crashing stock charts, vertical 9:16',
              durationSec: 3,
            },
            {
              narration: 'Un solo documento interno demuestra la escala del fraude.',
              visualPrompt: 'Close-up of confidential financial document with red highlights',
              durationSec: 5,
            },
            {
              narration: 'Mira el vídeo completo en el canal para la historia entera.',
              visualPrompt: 'CTA end card pointing to full documentary on channel',
              durationSec: 4,
            },
          ],
        },
      } as T;
    }

    if (prompt.includes('escena 1 (gancho)') || prompt.includes('SOLO la escena 1')) {
      return {
        narration: '¿Sabías que nadie te contó este detalle del escándalo?',
        visualPrompt: 'Dramatic documentary hook frame with bold question text overlay',
      } as T;
    }

    return {
      title: 'La IA que edita vídeos sola ya está aquí',
      description: 'Descubre cómo pipelines automatizados generan Shorts con IA.\n\n#IA #YouTube #Automatización',
      tags: ['IA', 'YouTube', 'automatización', 'shorts', 'tech'],
      variantA: {
        hook: '¿Y si tu próximo vídeo se creara mientras duermes?',
        scenes: [
          {
            narration: 'La mayoría de creadores pierden horas editando cada Short.',
            visualPrompt: 'Persona frustrada frente a editor de vídeo en estudio oscuro',
            durationSec: 4,
          },
          {
            narration: 'Reelpath genera ideas, guion, voz e imágenes en un solo pipeline.',
            visualPrompt: 'Dashboard futurista con pipeline automatizado en pantallas múltiples',
            durationSec: 5,
          },
          {
            narration: 'Solo apruebas o rechazas. El resto es automático.',
            visualPrompt: 'Botón approve reject minimalista sobre fondo neutro',
            durationSec: 4,
          },
        ],
      },
      variantB: {
        hook: 'Esto es lo que nadie te dice sobre canales automatizados.',
        scenes: [
          {
            narration: 'No se trata de spam. Se trata de sistemas.',
            visualPrompt: 'Infraestructura de servidores abstracta con luces azules',
            durationSec: 3,
          },
          {
            narration: 'Ideas con score de viralidad, guiones A/B, render FFmpeg.',
            visualPrompt: 'Gráficos de analytics y scores en monitor grande',
            durationSec: 5,
          },
          {
            narration: 'Human-in-the-loop: tú decides qué se publica.',
            visualPrompt: 'Usuario revisando cola de vídeos en interfaz limpia',
            durationSec: 4,
          },
        ],
      },
    } as T;
  }
}

let client: LlmClient | null = null;
let orgApiKeyOverride: string | undefined;

/** Usa la API key BYOK de la organización durante el pipeline del worker. */
export function setOrgOpenAiApiKey(apiKey: string | undefined): void {
  orgApiKeyOverride = apiKey;
  client = null;
}

export function clearOrgOpenAiApiKey(): void {
  orgApiKeyOverride = undefined;
  client = null;
}

/** Drop cached LLM client so org/env overrides take effect on next getLlmClient(). */
export function resetLlmClient(): void {
  client = null;
}

export function getLlmClient(): LlmClient {
  if (!client) {
    const connection = resolveLlmConnection({ orgOpenAiApiKey: orgApiKeyOverride });
    if (connection) {
      console.info(`[llm] provider=${connection.provider} model=${connection.model}`);
      client = new OpenAiCompatibleClient({
        apiKey: connection.apiKey,
        baseURL: connection.baseURL,
        provider: connection.provider,
        model: connection.model,
      });
    } else if (loadConfig().MOCK_EXTERNAL_APIS) {
      console.info('[llm] MOCK_EXTERNAL_APIS=true — MockLlmClient (solo desarrollo local)');
      client = new MockLlmClient();
    } else {
      throw new Error(
        'Sin clave LLM configurada. Añade DeepSeek u OpenAI en Ajustes → Secretos de plataforma, ' +
          'BYOK de la organización, o DEEPSEEK_API_KEY / OPENAI_API_KEY en .env.',
      );
    }
  }
  return client;
}

/** True solo en desarrollo con MOCK_EXTERNAL_APIS y sin claves reales. */
export function isLlmMockMode(): boolean {
  if (!loadConfig().MOCK_EXTERNAL_APIS) return false;
  if (orgApiKeyOverride?.trim()) return false;
  return !resolveLlmConnection({ orgOpenAiApiKey: orgApiKeyOverride });
}

/** Label for logs: MOCK (solo si MOCK_EXTERNAL_APIS) o `deepseek:model` / `openai:model`. */
export function getActiveLlmLabel(): string {
  if (isLlmMockMode()) return 'MOCK (sin coste API)';
  const connection = resolveLlmConnection({ orgOpenAiApiKey: orgApiKeyOverride });
  if (!connection) return 'sin-clave-LLM';
  return `${connection.provider}:${connection.model || getLlmModel({ orgOpenAiApiKey: orgApiKeyOverride })}`;
}

export * from './json-normalize.js';

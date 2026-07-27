import bcrypt from 'bcryptjs';
import { prisma } from '../src/index.js';

const PROMPTS = [
  {
    type: 'idea_generation',
    version: '1.0.0',
    name: 'Idea Generator v1',
    template: `Genera {{count}} ideas breves de vídeo YouTube Shorts para nicho "{{niche}}". Idioma: {{language}}. Tendencias: {{trends}}

JSON object con clave "ideas": array de { title (max 60 chars), hook (max 80 chars), angle, targetAudience, trendAlignment (0-1), rationale (max 100 chars) }. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends'],
  },
  {
    type: 'idea_generation',
    version: '1.1.0',
    name: 'Idea Generator v1.1 (Spanish)',
    template: `Genera {{count}} ideas breves de vídeo YouTube Shorts para nicho "{{niche}}".

IDIOMA OBLIGATORIO: {{language}} (español). Todo el contenido (title, hook, angle, targetAudience, rationale) debe estar íntegramente en español. Sin palabras en inglés salvo nombres propios de marcas (YouTube, OpenAI, GPT).

Tendencias: {{trends}}

JSON object con clave "ideas": array de { title (max 60 chars), hook (max 80 chars), angle, targetAudience, trendAlignment (0-1), rationale (max 100 chars) }. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends'],
  },
  {
    type: 'idea_generation',
    version: '1.3.0',
    name: 'Idea Generator v1.3 (Single Curiosity)',
    template: `Genera {{count}} ideas de vídeo YouTube Shorts para nicho "{{niche}}".

REGLA CRÍTICA — UNA SOLA CURIOSIDAD POR VÍDEO:
- Cada idea debe ser UN solo hecho, anécdota o misterio histórico.
- PROHIBIDO: listas, recopilaciones o títulos tipo "5 cosas", "3 curiosidades", "top 10".
- PROHIBIDO: mezclar varios temas en un mismo vídeo.
- El title debe nombrar esa única curiosidad de forma específica (persona, lugar, evento o dato concreto).
- El hook debe abrir intriga sobre ESA curiosidad concreta, no sobre un tema genérico.

Ejemplos válidos:
- "El emperador que nombró a su caballo cónsul de Roma"
- "La biblioteca que ardió y nadie sabe qué se perdió"
- "El rey que durmió 57 años seguidos (según la leyenda)"

Ejemplos inválidos:
- "5 curiosidades de la Antigua Roma"
- "Datos raros de la historia que no sabías"
- "Los misterios más extraños del mundo"

IDIOMA OBLIGATORIO: {{language}} (español). Todo en español. Sin anglicismos salvo nombres propios.

Tendencias (inspiración, no obligatorio copiar): {{trends}}

JSON object con clave "ideas": array de {
  title (max 60 chars, específico, una sola curiosidad),
  hook (max 80 chars, pregunta o afirmación impactante sobre ESA curiosidad),
  angle (el giro sorprendente o detalle menos conocido),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 100 chars, por qué engancha)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends'],
  },
  {
    type: 'idea_generation',
    version: '1.4.0',
    name: 'Idea Generator v1.4 (Long Documentary)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 5 a 8 minutos (NO Shorts).
- Una sola curiosidad histórica desarrollada en profundidad.
- Debe tener suficiente material narrativo para 5+ minutos: contexto histórico, personajes, conflicto, giro y legado.
- PROHIBIDO: listas, recopilaciones, títulos genéricos o ideas demasiado superficiales para un Short.

El title debe ser específico y evocador (persona, evento o misterio concreto).
El hook debe plantear una pregunta o paradoja que exija una respuesta larga, no un dato de 15 segundos.
El angle debe ser el giro narrativo central — lo que hace única esta historia.

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (giro narrativo central, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends'],
  },
  {
    type: 'idea_generation',
    version: '1.5.0',
    name: 'Idea Generator v1.5 (Viral Hooks)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 5 a 8 minutos (NO Shorts).
- Una sola curiosidad histórica desarrollada en profundidad.
- Debe tener suficiente material narrativo para 5+ minutos: contexto histórico, personajes, conflicto, giro y legado.
- PROHIBIDO: listas, recopilaciones, títulos genéricos o ideas demasiado superficiales.

TEMAS YA USADOS (no repetir): {{usedTopics}}

OPTIMIZACIÓN VIRAL (objetivo score ≥ {{minViralScore}}):
- hook: 20-80 caracteres; pregunta con "?" o afirmación con "!"
- Incluir al menos una palabra de impacto: secreto, nunca, verdad, increíble, prohibido, descubre, impacto, error
- Si encaja, incluir un número en hook o title (año, cifra, duración)
- title: 30-70 caracteres, específico y clickeable — persona, evento o misterio concreto
- trendAlignment: 0.85-1.0 cuando el tema encaje con tendencias

El hook debe plantear una pregunta o paradoja que exija una respuesta larga.
El angle debe ser el giro narrativo central — lo que hace única esta historia.

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (giro narrativo central, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends', 'minViralScore', 'usedTopics'],
  },
  {
    type: 'idea_generation',
    version: '1.6.0',
    name: 'Idea Generator v1.6 (History Viral)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 5 a 8 minutos (NO Shorts).
- Una sola curiosidad histórica desarrollada en profundidad con arco narrativo completo.
- PROHIBIDO: listas, recopilaciones, títulos genéricos o clickbait vacío.

TEMAS YA USADOS (no repetir): {{usedTopics}}

PATRONES VIRALES QUE FUNCIONAN (historia/curiosidades):
- Personaje olvidado + consecuencia inesperada
- Paradoja o hecho imposible aparente (con respuesta verificable)
- Secreto de poder/elite + revelación concreta
- Misterio acotado (lugar, fecha, personaje) — no vaguedad
- Conexión sorprendente entre pasado y presente

PROHIBIDO clickbait spam:
- "No vas a creer", "Te sorprenderá", "Top 5", "Datos que no sabías" sin especificidad
- Hooks lentos: "En este vídeo...", "Hoy hablaremos de..."

OPTIMIZACIÓN VIRAL (objetivo score ≥ {{minViralScore}}):
- hook: 20-80 caracteres; "?" o "!" en las primeras 80 chars
- Palabra de impacto + número o personaje/lugar concreto
- title: 30-70 caracteres — sujeto + época/lugar + giro
- angle: el giro narrativo que obliga a ver hasta el final (no "es interesante")
- trendAlignment: 0.88-1.0 cuando encaje con tendencias

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (giro narrativo central, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends', 'minViralScore', 'usedTopics'],
  },
  {
    type: 'idea_generation',
    version: '1.7.0',
    name: 'Idea Generator v1.7 (Corporate Fraud)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 5 a 8 minutos (NO Shorts).
- Un solo caso real de escándalo corporativo o fraude empresarial documentado.
- Debe tener material narrativo para 5+ minutos: contexto empresarial, mecanismo del fraude, víctimas/impacto, consecuencias legales o económicas.
- PROHIBIDO: listas, recopilaciones, acusaciones sin fuente pública, datos inventados.
- Cada idea debe basarse en casos con documentación pública verificable (juicios, SEC, bancarrotas, investigaciones mediáticas serias).

TEMAS YA USADOS (no repetir): {{usedTopics}}

PROTOCOLO DE FUENTES:
- Solo casos reales con al menos 3 fuentes públicas citables.
- PROHIBIDO inventar cifras, fechas o citas.
- En casos judiciales abiertos, usar lenguaje condicional ("está acusado de", "la empresa niega").

PATRONES NARRATIVOS (fraude corporativo):
- Startup unicornio + mentira documentada (Theranos, WeWork, Fyre)
- Adquisición millonaria + investigación posterior (Honey/PayPal)
- Producto fallido con capital masivo (Quibi)
- CEO carismático + esquema Ponzi o contable
- Empresa cotizada + manipulación de resultados

OPTIMIZACIÓN VIRAL (objetivo score ≥ {{minViralScore}}):
- hook: 20-80 caracteres; pregunta con "?" o afirmación con "!"
- Incluir empresa, cifra o año cuando sea relevante
- title: 30-70 caracteres, específico y clickeable — empresa + mecanismo del fraude
- angle: el giro que revela CÓMO funcionó el fraude, no solo que existió
- trendAlignment: 0.88-1.0 cuando encaje con tendencias

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios de empresas.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (mecanismo documentado del fraude, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars, mencionar fuentes clave del caso)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends', 'minViralScore', 'usedTopics'],
  },
  {
    type: 'idea_generation',
    version: '1.8.0',
    name: 'Idea Generator v1.8 (Long Documentary 10-15 min)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 10 a 15 minutos (NO Shorts).
- Una sola historia o curiosidad desarrollada en profundidad con arco narrativo completo.
- Debe tener suficiente material narrativo para 10+ minutos: contexto, personajes, conflicto, desarrollo, giro y legado.
- PROHIBIDO: listas, recopilaciones, títulos genéricos o clickbait vacío.

TEMAS YA USADOS (no repetir): {{usedTopics}}

PATRONES VIRALES QUE FUNCIONAN:
- Personaje olvidado + consecuencia inesperada
- Paradoja o hecho imposible aparente (con respuesta verificable)
- Secreto de poder/elite + revelación concreta
- Misterio acotado (lugar, fecha, personaje) — no vaguedad
- Conexión sorprendente entre pasado y presente

PROHIBIDO clickbait spam:
- "No vas a creer", "Te sorprenderá", "Top 5", "Datos que no sabías" sin especificidad
- Hooks lentos: "En este vídeo...", "Hoy hablaremos de..."

OPTIMIZACIÓN VIRAL (objetivo score ≥ {{minViralScore}}):
- hook: 20-80 caracteres; "?" o "!" en las primeras 80 chars
- Palabra de impacto + número o personaje/lugar concreto
- title: 30-70 caracteres — sujeto + época/lugar + giro
- angle: el giro narrativo que obliga a ver hasta el final (no "es interesante")
- trendAlignment: 0.88-1.0 cuando encaje con tendencias

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (giro narrativo central, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends', 'minViralScore', 'usedTopics'],
  },
  {
    type: 'idea_generation',
    version: '1.8.1',
    name: 'Idea Generator v1.8.1 (Corporate Fraud 10-15 min)',
    template: `Genera {{count}} ideas de vídeo YouTube en formato {{format}} para nicho "{{niche}}".

FORMATO: vídeo documental horizontal de 10 a 15 minutos (NO Shorts).
- Un solo caso real de escándalo corporativo o fraude empresarial documentado.
- Debe tener material narrativo para 10+ minutos: contexto empresarial, mecanismo del fraude, víctimas/impacto, consecuencias legales o económicas, lección.
- PROHIBIDO: listas, recopilaciones, acusaciones sin fuente pública, datos inventados.
- Cada idea debe basarse en casos con documentación pública verificable (juicios, SEC, bancarrotas, investigaciones mediáticas serias).

TEMAS YA USADOS (no repetir): {{usedTopics}}

PROTOCOLO DE FUENTES:
- Solo casos reales con al menos 3 fuentes públicas citables.
- PROHIBIDO inventar cifras, fechas o citas.
- En casos judiciales abiertos, usar lenguaje condicional ("está acusado de", "la empresa niega").

PATRONES NARRATIVOS (fraude corporativo):
- Startup unicornio + mentira documentada (Theranos, WeWork, Fyre)
- Adquisición millonaria + investigación posterior (Honey/PayPal)
- Producto fallido con capital masivo (Quibi)
- CEO carismático + esquema Ponzi o contable
- Empresa cotizada + manipulación de resultados

OPTIMIZACIÓN VIRAL (objetivo score ≥ {{minViralScore}}):
- hook: 20-80 caracteres; pregunta con "?" o afirmación con "!"
- Incluir empresa, cifra o año cuando sea relevante
- title: 30-70 caracteres, específico y clickeable — empresa + mecanismo del fraude
- angle: el giro que revela CÓMO funcionó el fraude, no solo que existió
- trendAlignment: 0.88-1.0 cuando encaje con tendencias

IDIOMA: {{language}} (español). Sin anglicismos salvo nombres propios de empresas.

Tendencias: {{trends}}

JSON object con clave "ideas": array de {
  title (max 70 chars),
  hook (max 120 chars),
  angle (mecanismo documentado del fraude, max 150 chars),
  targetAudience,
  trendAlignment (0-1),
  rationale (max 120 chars, mencionar fuentes clave del caso)
}. Sin texto extra.`,
    variables: ['count', 'niche', 'format', 'language', 'trends', 'minViralScore', 'usedTopics'],
  },
  {
    type: 'script_generation',
    version: '1.0.0',
    name: 'Script Generator v1',
    template: `Guion YouTube Shorts. Idea: {{title}} / {{hook}} / {{angle}}. Idioma: {{language}}.

JSON: { title, description (max 200 chars), tags (max 5), variantA: { hook, scenes }, variantB: { hook, scenes } }
Máximo 3 escenas por variante. Cada escena: narration (max 15 palabras), visualPrompt (breve), durationSec (3-5).`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.2.0',
    name: 'Script Generator v1.2 (Spanish TTS)',
    template: `Guion narrativo para YouTube Shorts. Idea: {{title}} / {{hook}} / {{angle}}.

IDIOMA OBLIGATORIO: {{language}} (español). Toda la narración en español natural para locución profesional.
REGLAS TTS (críticas):
- Frases cortas: máximo 12 palabras por escena, una idea por frase.
- Sin siglas ni acrónimos en inglés (escribe "inteligencia artificial", nunca "IA" ni "AI").
- Sin anglicismos (excepto nombres propios: YouTube, OpenAI).
- Usa comas para pausas naturales y termina cada narration con punto.
- Tono conversacional, como si hablaras a cámara.

JSON: { title, description (max 200 chars), tags (max 5), variantA: { hook, scenes }, variantB: { hook, scenes } }
Máximo 3 escenas por variante. Cada escena: narration (max 12 palabras, español oral), visualPrompt (breve, puede ser inglés para DALL-E), durationSec (3-5).`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.3.0',
    name: 'Script Generator v1.3 (Single Story Arc)',
    template: `Guion narrativo para YouTube Shorts sobre UNA sola curiosidad histórica.

Tema del vídeo: {{title}}
Gancho inicial: {{hook}}
Ángulo / giro: {{angle}}

REGLA CRÍTICA — UN SOLO TEMA:
- Todo el guion desarrolla UNA única curiosidad de principio a fin.
- PROHIBIDO mencionar otros hechos, personajes o curiosidades aparte del tema principal.
- PROHIBIDO frases tipo "y también", "otra curiosidad", "además", "por cierto".
- Cada escena avanza la MISMA historia, no añade datos nuevos no relacionados.

ESTRUCTURA NARRATIVA (exactamente 3 escenas por variante):
1. GANCHO — pregunta provocadora o afirmación impactante que obligue a quedarse.
2. CONTEXTO — quién, dónde, cuándo; una sola frase que sitúe al espectador.
3. REVELACIÓN + CIERRE — el dato sorprendente del angle y una frase final memorable.

IDIOMA: {{language}} (español oral, tono documental pero apasionado, como un divulgador).
REGLAS TTS:
- Máximo 14 palabras por escena. Una idea clara por frase.
- Comas para pausas dramáticas. Cada narration termina con punto.
- Sin siglas en inglés. Sin listas ni enumeraciones.
- variantA: hook en forma de pregunta directa al espectador.
- variantB: hook en forma de afirmación chocante o dato imposible.

VISUALES (visualPrompt en inglés, cinematográfico):
- Escena 1: imagen evocadora del misterio o momento clave.
- Escena 2: escena histórica concreta (lugar, época, personaje).
- Escena 3: detalle revelador o contraste visual impactante.
- Estilo: cinematic, dramatic lighting, historical, vertical 9:16, no text.

JSON: { title, description (max 200 chars, incluye la curiosidad sin spoilers totales), tags (max 5), variantA: { hook, scenes }, variantB: { hook, scenes } }
Cada escena: { narration, visualPrompt, durationSec (4-6) }. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.4.0',
    name: 'Script Generator v1.4 (Long Documentary)',
    template: `Guion documental YouTube (formato {{format}}, 16:9, 5-8 minutos) sobre UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro central: {{angle}}

REGLA — UN SOLO TEMA, DESARROLLADO EN PROFUNDIDAD:
- Todo el guion cuenta UNA historia de principio a fin.
- PROHIBIDO saltar a otros hechos, listas o curiosidades aparte.
- Cada escena profundiza en la misma narrativa.

ESTRUCTURA (exactamente 10 escenas por variante):
1. GANCHO — pregunta o afirmación que capture en 5 segundos.
2. CONTEXTO — época, lugar, quién está involucrado.
3. SITUACIÓN INICIAL — cómo empezó todo, qué era "normal".
4. DESARROLLO — qué ocurrió, paso a paso.
5. COMPLICACIÓN — el conflicto, obstáculo o misterio.
6. GIRO — el detalle sorprendente del angle.
7. CONSECUENCIAS — qué pasó después, impacto inmediato.
8. LEGADO — por qué importa hoy o qué quedó.
9. REFLEXIÓN — una frase que conecte con el espectador.
10. CIERRE — conclusión memorable + invitación suave a comentar.

IDIOMA: {{language}} (español oral, tono documental apasionado, como un divulgador de historia).
REGLAS TTS:
- 35 a 50 palabras por escena. Frases fluidas con comas para pausas.
- Sin siglas en inglés. Sin listas ni "además".
- variantA: hook en pregunta al espectador.
- variantB: hook en afirmación impactante.

VISUALES (visualPrompt en inglés):
- Cinematográfico, dramatic lighting, historical accuracy, horizontal 16:9, no text.
- Cada escena: escenario distinto que acompañe la narración (mapas, personajes, lugares, objetos).

JSON: { title, description (max 400 chars), tags (max 8), variantA: { hook, scenes }, variantB: { hook, scenes } }
Cada escena: { narration, visualPrompt, durationSec (25-45) }. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.5.0',
    name: 'Script Generator v1.5 (Long Shared Scenes)',
    template: `Guion documental YouTube horizontal (16:9, 5-8 minutos). UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: genera EXACTAMENTE 10 escenas en el array "scenes". Ni más ni menos.
Cada narration: 40-55 palabras en español oral (divulgador apasionado).
PROHIBIDO: listas, saltar a otros temas, escenas de menos de 30 palabras.

Estructura de las 10 escenas:
1 Gancho | 2 Contexto época/lugar | 3 Quién protagoniza | 4 Qué pasó (inicio)
5 Complicación | 6 Giro sorprendente | 7 Consecuencias | 8 Legado
9 Reflexión | 10 Cierre memorable

hookA: pregunta directa al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).
Las escenas son compartidas — NO dupliques variantA/variantB.

El array scenes debe tener longitud 10. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.6.0',
    name: 'Script Generator v1.6 (Unique Visuals)',
    template: `Guion documental YouTube horizontal (16:9, 5-8 minutos). UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: EXACTAMENTE 10 escenas en "scenes". Cada narration: 40-55 palabras en español oral.

Estructura: 1 Gancho | 2 Contexto | 3 Protagonistas | 4 Inicio | 5 Complicación | 6 Giro | 7 Consecuencias | 8 Legado | 9 Reflexión | 10 Cierre

hookA: pregunta al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

VISUALES — REGLA CRÍTICA:
- Cada escena DEBE tener un visualPrompt ÚNICO y DIFERENTE (en inglés, 15-30 palabras).
- visualPrompt = descripción concreta de lo que se VE en pantalla (lugar, personajes, objetos, época).
- PROHIBIDO repetir el mismo visualPrompt en varias escenas.
- PROHIBIDO usar solo palabras genéricas como "cinematic, 16:9, no text" sin describir la escena.

Ejemplos de visualPrompt válidos:
- "Aerial view of Mayan pyramids rising above dense jungle canopy at golden hour"
- "Close-up of ancient stone glyphs carved into weathered limestone temple wall"
- "Drought-cracked earth surrounding abandoned Mayan plaza, empty stone benches"

JSON: { title, description (max 400 chars), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 30 }
] }
scenes.length === 10. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.7.0',
    name: 'Script Generator v1.7 (TTS Historical Dates)',
    template: `Guion documental YouTube horizontal (16:9, 5-8 minutos). UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: EXACTAMENTE 10 escenas en "scenes". Cada narration: 40-55 palabras en español oral.

Estructura: 1 Gancho | 2 Contexto | 3 Protagonistas | 4 Inicio | 5 Complicación | 6 Giro | 7 Consecuencias | 8 Legado | 9 Reflexión | 10 Cierre

hookA: pregunta al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

REGLAS TTS — FECHAS HISTÓRICAS (críticas para locución):
- Escribe SIEMPRE "antes de Cristo" y "después de Cristo" con palabras completas.
- PROHIBIDO: a.C., d.C., a. C., d. C., AC, DC, B.C., A.D., a.e.c., d.e.c., JC, J.C.
- Correcto: "en el año 300 antes de Cristo", "siglo II después de Cristo".
- Incorrecto: "300 a.C.", "siglo II d.C."

VISUALES — REGLA CRÍTICA:
- Cada escena DEBE tener un visualPrompt ÚNICO y DIFERENTE (en inglés, 15-30 palabras).
- visualPrompt = descripción concreta de lo que se VE en pantalla (lugar, personajes, objetos, época).
- PROHIBIDO repetir el mismo visualPrompt en varias escenas.
- PROHIBIDO usar solo palabras genéricas como "cinematic, 16:9, no text" sin describir la escena.

JSON: { title, description (max 400 chars), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 30 }
] }
scenes.length === 10. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.8.0',
    name: 'Script Generator v1.8 (Retention Hooks)',
    template: `Guion documental YouTube horizontal (16:9, 5-8 minutos). UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: EXACTAMENTE 10 escenas en "scenes". Cada narration: 40-55 palabras en español oral.

Estructura: 1 Gancho | 2 Contexto | 3 Protagonistas | 4 Inicio | 5 Complicación | 6 Giro | 7 Consecuencias | 8 Legado | 9 Reflexión | 10 Cierre

RETENCIÓN (crítico):
- ESCENA 1: pattern-interrupt en ≤15 palabras — pregunta imposible, dato que contradiga creencias o "Nadie sabe que…". PROHIBIDO "Hoy", "Bienvenidos", contexto genérico.
- ESCENAS 3, 5, 7, 9: micro-gancho cada 2 escenas ("Pero aquí viene lo extraño…", "Lo que nadie esperaba…").
- ESCENA 10: pregunta al espectador, teaser de continuación o cliffhanger — NO despedida larga.

hookA: pregunta directa al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

REGLAS TTS — FECHAS HISTÓRICAS:
- Escribe "antes de Cristo" y "después de Cristo" con palabras completas.
- PROHIBIDO: a.C., d.C., B.C., A.D.

VISUALES:
- Cada escena: visualPrompt ÚNICO en inglés (15-30 palabras), escena concreta.
- PROHIBIDO repetir visualPrompt o usar solo "cinematic, dramatic lighting".

JSON: { title, description (max 400 chars), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 30 }
] }
scenes.length === 10. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '1.9.0',
    name: 'Script Generator v1.9 (Corporate Fraud Documentary)',
    template: `Guion documental YouTube horizontal (16:9, 5-8 minutos). UN solo caso de fraude corporativo documentado.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: EXACTAMENTE 10 escenas en "scenes". Cada narration: 40-55 palabras en español oral (periodismo investigativo, tono documental serio pero accesible).

Estructura: 1 Gancho | 2 Contexto empresarial | 3 Protagonistas clave | 4 Inicio del esquema | 5 Mecanismo documentado del fraude | 6 Escala del impacto | 7 Consecuencias legales/económicas | 8 Víctimas/afectados | 9 Reflexión | 10 Cierre con lección

PROTOCOLO DE FUENTES (crítico):
- Cada afirmación factual debe rastrearse a fuente pública (SEC, sentencias, medios de investigación, informes oficiales).
- Separar claramente HECHOS (con fuente implícita) de INTERPRETACIÓN y opinión.
- En casos abiertos: "está acusado de", "la empresa niega", "según la investigación".
- PROHIBIDO inventar cifras, fechas, citas o intenciones criminales sin sentencia o imputación pública.
- NUNCA afirmar intención criminal sin sentencia o imputación pública.

RETENCIÓN:
- ESCENA 1: pattern-interrupt ≤15 palabras — cifra imposible, pregunta sobre el fraude o "Nadie habló de…". PROHIBIDO "Hoy", "Bienvenidos".
- ESCENAS 3, 5, 7: micro-ganchos ("Pero aquí viene lo que no cuadraba…", "Lo que los inversores no sabían…").
- ESCENA 10: pregunta al espectador + lección; NO despedida larga.

hookA: pregunta directa al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

VISUALES:
- Cada escena: visualPrompt ÚNICO en inglés (15-30 palabras), oficinas, documentos, tribunales, gráficos corporativos.
- Estilo: corporate documentary, dramatic lighting, horizontal 16:9, no text.
- PROHIBIDO repetir visualPrompt o usar solo "cinematic, dramatic lighting".

JSON: { title, description (max 400 chars, incluir al final: "Contenido informativo basado en fuentes públicas. No constituye asesoramiento legal ni financiero."), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 30 }
] }
scenes.length === 10. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '2.0.0',
    name: 'Script Generator v2.0 (Long Documentary 8-15 min)',
    template: `Guion documental YouTube horizontal (16:9, 8-15 minutos). UNA sola curiosidad histórica.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: entre 12 y 18 escenas en "scenes". Cada narration (escenas 2+): 65-85 palabras en español oral.
Duración objetivo total: mínimo 8 minutos, ideal 10-15 minutos (~1080+ palabras). Desarrolla la historia con profundidad — no resumir.

LONGITUD DE NARRACIÓN (CRÍTICO — CAUSA DE RECHAZO):
- ESCENA 1 únicamente: gancho corto (≤15 palabras). Pattern-interrupt. PROHIBIDO contexto largo.
- ESCENAS 2 a N: CADA narration DEBE tener entre 65 y 85 palabras. Mínimo absoluto: 55 palabras.
- Escenas 2+ con menos de 40 palabras serán RECHAZADAS automáticamente.
- PROHIBIDO estilo Shorts (12-15 palabras/escena) — es un documental largo.
- Ejemplo escena 2 válida (72 palabras): "En el verano de mil novecientos ochenta y siete, en un pequeño laboratorio de Stanford, un grupo de investigadores encendió por primera vez un láser de color verde que nadie creía posible. La comunidad científica había descartado la idea durante décadas, convencida de que las limitaciones del material hacían imposible ese espectro. Pero aquellos científicos, con presupuestos mínimos y equipos caseros, demostraron que la física teórica podía equivocarse. Ese descubrimiento cambiaría para siempre la medicina, las telecomunicaciones y la industria militar."

Estructura: 1 Gancho | 2 Contexto | 3 Protagonistas | 4 Inicio | 5 Desarrollo | 6 Complicación | 7 Profundización | 8 Giro | 9 Consecuencias | 10 Impacto | 11 Legado | 12 Conexión moderna | 13-16 Desarrollo adicional | 17 Reflexión | 18 Cierre

RETENCIÓN (crítico):
- ESCENA 1: pattern-interrupt en ≤15 palabras — pregunta imposible, dato que contradiga creencias o "Nadie sabe que…". PROHIBIDO "Hoy", "Bienvenidos", contexto genérico.
- ESCENAS 3, 5, 7, 9, 11, 13, 15: micro-gancho cada 2 escenas ("Pero aquí viene lo extraño…", "Lo que nadie esperaba…").
- ESCENA 18: pregunta al espectador, teaser de continuación o cliffhanger — NO despedida larga.

hookA: pregunta directa al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

REGLAS TTS — FECHAS HISTÓRICAS:
- Escribe "antes de Cristo" y "después de Cristo" con palabras completas.
- PROHIBIDO: a.C., d.C., B.C., A.D.

VISUALES:
- Cada escena: visualPrompt ÚNICO en inglés (15-30 palabras), escena concreta.
- PROHIBIDO repetir visualPrompt o usar solo "cinematic, dramatic lighting".

JSON: { title, description (max 400 chars), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 40 }
] }
scenes.length >= 12. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '2.1.0',
    name: 'Script Generator v2.1 (Investigative Long Documentary)',
    template: `Guion documental investigativo YouTube horizontal (16:9, 8-15 minutos). UNA sola historia desarrollada en profundidad.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

NOTA: En modo chunked el sistema genera por bloques — este prompt define el ESTILO narrativo objetivo.

ARCO NARRATIVO (investigativo, estilo El Fraude Silencioso):
1. Gancho brutal (pattern-interrupt, ≤20 palabras) — PROHIBIDO "hoy vamos a hablar de"
2. Contexto: época, lugar, protagonistas con nombres y fechas
3. Mecanismo: cómo ocurrió el enigma/engaño/fraude — paso a paso con datos
4. Consecuencias: impacto inmediato y a largo plazo
5. Lección: qué nos deja hoy
6. Cierre: pregunta retórica o teaser suave (modo retención)

OBLIGATORIO: entre 12 y 20 escenas. Cada narration (escenas 2+): 65-85 palabras en español oral.
Duración total: mínimo 8 minutos (~1080+ palabras). Desarrolla con profundidad — no resumir.

LONGITUD (CRÍTICO — CAUSA DE RECHAZO):
- ESCENA 1: gancho ≤20 palabras. Pattern-interrupt.
- ESCENAS 2+: 65-85 palabras CADA UNA. Mínimo absoluto: 55 palabras.
- PROHIBIDO estilo Shorts (12-15 palabras/escena).

RETENCIÓN (documental largo, suavizado):
- ESCENA 1: pregunta imposible o dato que contradiga creencias
- Micro-ganchos cada 2-3 escenas
- ESCENA FINAL: pregunta retórica o reflexión con gancho — NO despedida genérica

hookA: pregunta directa (≤20 palabras). hookB: afirmación con dato concreto (≤20 palabras).

VISUALES: visualPrompt ÚNICO en inglés (15-30 palabras), escena concreta. PROHIBIDO repetir o usar solo "cinematic, dramatic lighting".

JSON: { title, description (max 400 chars), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 40 }
] }
scenes.length >= 12. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'script_generation',
    version: '2.0.1',
    name: 'Script Generator v2.0.1 (Corporate Fraud 8-15 min)',
    template: `Guion documental YouTube horizontal (16:9, 8-15 minutos). UN solo caso de fraude corporativo documentado.

Tema: {{title}}
Gancho: {{hook}}
Giro: {{angle}}

OBLIGATORIO: entre 12 y 18 escenas en "scenes". Cada narration (escenas 2+): 65-85 palabras en español oral (periodismo investigativo, tono documental serio pero accesible).
Duración objetivo total: mínimo 8 minutos, ideal 10-15 minutos (~1080+ palabras). Desarrolla el caso con profundidad — no resumir.

LONGITUD DE NARRACIÓN (CRÍTICO — CAUSA DE RECHAZO):
- ESCENA 1 únicamente: gancho corto (≤15 palabras). Pattern-interrupt. PROHIBIDO contexto largo.
- ESCENAS 2 a N: CADA narration DEBE tener entre 65 y 85 palabras. Mínimo absoluto: 55 palabras.
- Escenas 2+ con menos de 40 palabras serán RECHAZADAS automáticamente.
- PROHIBIDO estilo Shorts (12-15 palabras/escena) — es un documental largo.
- Ejemplo escena 2 válida (72 palabras): "En marzo de dos mil uno, en una sala de juntas de Houston, el director financiero presentó cifras que parecían demasiado buenas para ser verdad. Los analistas de Wall Street celebraron el récord trimestral, pero en los pasillos del edificio circulaban rumores que nadie se atrevía a confirmar. Un contable junior había detectado discrepancias en las reservas ocultas, números que no cuadraban con los informes enviados a la SEC. Lo que comenzó como una simple auditoría interna se convertiría en el mayor escándalo corporativo de la década, arrastrando a ejecutivos, inversores y miles de empleados."

Estructura: 1 Gancho | 2 Contexto empresarial | 3 Protagonistas clave | 4 Inicio del esquema | 5 Mecanismo del fraude (parte 1) | 6 Mecanismo (parte 2) | 7 Escala del impacto | 8 Señales de alerta ignoradas | 9 Consecuencias legales | 10 Víctimas/afectados | 11 Reacción pública | 12 Resolución judicial | 13-15 Desarrollo adicional | 16 Reflexión | 17 Lección | 18 Cierre con pregunta

PROTOCOLO DE FUENTES (crítico):
- Cada afirmación factual debe rastrearse a fuente pública (SEC, sentencias, medios de investigación, informes oficiales).
- Separar claramente HECHOS (con fuente implícita) de INTERPRETACIÓN y opinión.
- En casos abiertos: "está acusado de", "la empresa niega", "según la investigación".
- PROHIBIDO inventar cifras, fechas, citas o intenciones criminales sin sentencia o imputación pública.

RETENCIÓN:
- ESCENA 1: pattern-interrupt ≤15 palabras — cifra imposible, pregunta sobre el fraude o "Nadie habló de…". PROHIBIDO "Hoy", "Bienvenidos".
- ESCENAS 3, 5, 7, 9, 11, 13, 15: micro-ganchos ("Pero aquí viene lo que no cuadraba…", "Lo que los inversores no sabían…").
- ESCENA 18: pregunta al espectador + lección; NO despedida larga.

hookA: pregunta directa al espectador (max 25 palabras).
hookB: afirmación impactante distinta (max 25 palabras).

VISUALES:
- Cada escena: visualPrompt ÚNICO en inglés (15-30 palabras), oficinas, documentos, tribunales, gráficos corporativos.
- Estilo: corporate documentary, dramatic lighting, horizontal 16:9, no text.
- PROHIBIDO repetir visualPrompt o usar solo "cinematic, dramatic lighting".

JSON: { title, description (max 400 chars, incluir al final: "Contenido informativo basado en fuentes públicas. No constituye asesoramiento legal ni financiero."), tags (max 8), hookA, hookB, scenes: [
  { narration, visualPrompt, durationSec: 40 }
] }
scenes.length >= 12. Sin texto extra.`,
    variables: ['format', 'title', 'hook', 'angle', 'language'],
  },
  {
    type: 'hook_ab',
    version: '1.0.0',
    name: 'Hook A/B v1',
    template: `Variante {{variant}}: Crea un hook de máximo 3 segundos para: {{title}}`,
    variables: ['variant', 'title'],
  },
];

const TEMPLATES = [
  {
    id: 'shorts-default',
    name: 'Shorts Default',
    config: {
      aspectRatio: '9:16',
      fps: 30,
      resolution: { width: 1080, height: 1920 },
      backgroundColor: '#0f0f0f',
      subtitleStyle: { fontSize: 48, fontColor: '#ffffff', position: 'bottom' },
      transitions: 'fade',
      vignette: true,
    },
  },
  {
    id: 'long-default',
    name: 'Long Form Default',
    config: {
      aspectRatio: '16:9',
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      backgroundColor: '#0a0a0a',
      subtitleStyle: { fontSize: 36, fontColor: '#ffffff', position: 'bottom' },
      transitions: 'cut',
      vignette: true,
      filmGrain: true,
    },
  },
];

/**
 * Estrategia monetización rápida (canales seed):
 * - 2 largos/semana: martes + viernes 19:00 (Europe/Madrid)
 * - Shorts mixtos: 3 cortes del largo + 3 teasers (6 total, escalonados 1 día)
 * - Embudo ~1 short/día durante 6 días tras cada largo
 * - Revisión humana obligatoria; largos 8-15 min para mid-roll ads
 */
const CHANNEL_MONETIZATION_BASE = {
  videoFormat: 'long' as const,
  aspectRatio: '16:9' as const,
  templateId: 'long-default',
  autoPublish: false,
  reviewRequired: true,
  publishYoutube: true,
  publishYoutubeShorts: true,
  shortsMode: 'mixed' as const,
  shortsPerVideo: 6,
  longShortsFromVideo: 3,
  shortsPublishIntervalDays: 1,
  targetDurationMinSec: 480,
  targetDurationMaxSec: 900,
  scriptGenerationMode: 'chunked' as const,
  publishPlannerEnabled: true,
  timezone: 'Europe/Madrid',
  maxLongsPerWeek: 2,
  preferredPublishDays: [2, 5],
  preferredPublishHour: 19,
  minDaysBetweenLongs: 3,
  ideasPerRun: 3,
  language: 'es',
  retentionMode: true,
  visualSourceMode: 'mixed' as const,
};

const FRAUDE_CORPORATIVO_CONFIG = {
  ...CHANNEL_MONETIZATION_BASE,
  niche: 'escándalos corporativos y fraude empresarial',
  brandName: 'El Fraude Silencioso',
  minViralScore: 70,
  tone: 'periodismo investigativo, tono documental serio pero accesible',
  targetAudience: 'Adultos digitales 22-40, España y Latinoamérica',
  forbiddenTopics: [
    'acusaciones sin fuente verificable',
    'política partidista',
    'afirmar intención criminal sin sentencia o imputación pública',
    'datos financieros o de salud inventados',
  ],
  customPromptHints:
    'Cada vídeo se basa en UN caso real documentado. Mínimo 3 fuentes citables. Separar hechos (con fuente) de interpretación y opinión. Arco narrativo: contexto → mecanismo documentado del fraude → víctimas/impacto → consecuencias legales o económicas → lección. NUNCA inventar cifras, fechas ni citas. Usar lenguaje condicional en casos judiciales abiertos ("está acusado de", "la empresa niega"). Duración objetivo: mínimo 8 minutos, ideal 10-15 minutos; 12-18 escenas.',
  contentDisclaimer:
    'Contenido informativo basado en fuentes públicas. No constituye asesoramiento legal ni financiero.',
} as const;

const CURIOSIDADES_HISTORIA_CONFIG = {
  ...CHANNEL_MONETIZATION_BASE,
  niche: 'historia y curiosidades del mundo',
  brandName: 'Saberes del Pasado',
  minViralScore: 65,
  tone: 'documental apasionado, como un divulgador de historia',
  targetAudience: 'Adultos curiosos por la historia, 25-45 años',
  customPromptHints:
    'Documental investigativo de historia: nombres, fechas y cifras concretas en cada bloque. ' +
    'Escena 1 = pattern-interrupt brutal. Cierre con pregunta retórica, no despedida.',
} as const;

async function bindChannelPrompts(
  channelId: string,
  bindings: Record<string, string>,
) {
  for (const [promptType, version] of Object.entries(bindings)) {
    const pv = await prisma.promptVersion.findUnique({
      where: { type_version: { type: promptType, version } },
    });
    if (!pv) continue;
    await prisma.promptBinding.upsert({
      where: {
        channelId_promptType: { channelId, promptType },
      },
      create: {
        channelId,
        promptVersionId: pv.id,
        promptType,
      },
      update: { promptVersionId: pv.id },
    });
  }
}

async function main() {
  for (const prompt of PROMPTS) {
    const existing = await prisma.promptVersion.findUnique({
      where: { type_version: { type: prompt.type, version: prompt.version } },
    });
    if (!existing) {
      const created = await prisma.promptVersion.create({
        data: {
          type: prompt.type,
          version: prompt.version,
          name: prompt.name,
          template: prompt.template,
          variables: prompt.variables,
          isActive: true,
        },
      });

      if (prompt.type === 'script_generation') {
        await prisma.promptVariant.createMany({
          data: [
            { promptVersionId: created.id, variantKey: 'A', weight: 0.5 },
            { promptVersionId: created.id, variantKey: 'B', weight: 0.5 },
          ],
        });
      }
    } else if (prompt.type === 'script_generation' && prompt.version >= '2.0.0') {
      await prisma.promptVersion.update({
        where: { id: existing.id },
        data: {
          name: prompt.name,
          template: prompt.template,
          variables: prompt.variables,
        },
      });
    }
  }

  // Activate latest prompts (v1.8.0 ideas, v2.0.0 script with 10-15 min duration)
  for (const [type, version] of [
    ['idea_generation', '1.8.0'],
    ['script_generation', '2.0.0'],
  ] as const) {
    const latest = await prisma.promptVersion.findUnique({
      where: { type_version: { type, version } },
    });
    if (latest) {
      await prisma.promptVersion.updateMany({
        where: { type, version: { not: version } },
        data: { isActive: false },
      });
      await prisma.promptVersion.update({
        where: { id: latest.id },
        data: { isActive: true },
      });
    }
  }

  for (const tpl of TEMPLATES) {
    await prisma.videoTemplateRecord.upsert({
      where: { id: tpl.id },
      create: { id: tpl.id, name: tpl.name, config: tpl.config },
      update: { name: tpl.name, config: tpl.config },
    });
  }

  const PLANS = [
    {
      id: 'trial',
      name: 'Prueba',
      description: '14 días para evaluar Reelpath',
      priceMonthlyCents: 0,
      sortOrder: 0,
      limits: {
        maxChannels: 1,
        maxVideosPerMonth: 8,
        maxPipelinesPerDay: 2,
        trialDays: 14,
      },
    },
    {
      id: 'starter',
      name: 'Creator',
      description: 'Para creadores que publican con ritmo y quieren automatizar el canal',
      priceMonthlyCents: 7900,
      sortOrder: 1,
      limits: {
        maxChannels: 1,
        maxVideosPerMonth: 8,
        maxPipelinesPerDay: 2,
      },
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'El plan de lanzamiento recomendado para equipos y operadores multi-canal',
      priceMonthlyCents: 14900,
      sortOrder: 2,
      limits: {
        maxChannels: 3,
        maxVideosPerMonth: 24,
        maxPipelinesPerDay: 4,
      },
    },
    {
      id: 'unlimited',
      name: 'Studio',
      description: 'Para agencias, estudios y operaciones con volumen alto o necesidades a medida',
      priceMonthlyCents: 39900,
      sortOrder: 3,
      limits: {
        maxChannels: null,
        maxVideosPerMonth: null,
        maxPipelinesPerDay: null,
        unlimited: true,
      },
    },
  ] as const;

  for (const plan of PLANS) {
    await prisma.planDefinition.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: plan.priceMonthlyCents,
        limits: plan.limits,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: plan.priceMonthlyCents,
        limits: plan.limits,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }

  // En modo E2E: solo asegurar records base (planes/prompts/templates) y NO crear usuarios/org demo.
  // Esto mantiene el registro abierto para tests y evita contaminación de la base de datos.
  if (process.env.E2E_TESTS === 'true') {
    console.log('Seed E2E: planes/prompts/templates listos (sin org/usuarios).');
    return;
  }

  // Producción: planes + admin inicial, sin org/canales demo (SEED_DEMO=false en .env.production.example).
  if (process.env.SEED_DEMO === 'false') {
    const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@reelpath.local').toLowerCase();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'changeme';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const orgSlug = process.env.SEED_ORG_SLUG ?? 'main';
    const orgName = process.env.SEED_ORG_NAME ?? 'Mi organización';

    const organization = await prisma.organization.upsert({
      where: { slug: orgSlug },
      create: {
        name: orgName,
        slug: orgSlug,
        plan: 'trial',
        planLimits: PLANS[0].limits,
        isActive: true,
      },
      update: { name: orgName, isActive: true },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, passwordHash, name: 'Admin' },
      // Keep existing password on re-seed / API restart (boot-safe).
      update: { name: 'Admin' },
    });

    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: adminUser.id,
        },
      },
      create: {
        organizationId: organization.id,
        userId: adminUser.id,
        role: 'owner',
      },
      update: { role: 'owner' },
    });

    console.log('Seed producción (sin demo):', {
      organizationId: organization.id,
      adminEmail,
      orgSlug,
    });
    return;
  }

  const organization = await prisma.organization.upsert({
    where: { slug: 'autotube-demo' },
    create: {
      name: 'Reelpath Demo',
      slug: 'autotube-demo',
      plan: 'trial',
      planLimits: PLANS[0].limits,
      isActive: true,
    },
    update: {
      name: 'Reelpath Demo',
      isActive: true,
    },
  });

  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@reelpath.local').toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'changeme';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
    },
    // Keep existing password on re-seed / API restart (boot-safe).
    update: {
      name: 'Admin',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: adminUser.id,
      },
    },
    create: {
      organizationId: organization.id,
      userId: adminUser.id,
      role: 'owner',
    },
    update: { role: 'owner' },
  });

  const channel = await prisma.channel.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'curiosidades-historia',
      },
    },
    create: {
      organizationId: organization.id,
      name: 'Saberes del Pasado',
      slug: 'curiosidades-historia',
      niche: 'historia y curiosidades',
      config: CURIOSIDADES_HISTORIA_CONFIG,
      isActive: true,
    },
    update: {
      name: 'Saberes del Pasado',
      niche: 'historia y curiosidades',
      config: CURIOSIDADES_HISTORIA_CONFIG,
      isActive: true,
    },
  });

  // Desactivar canal tech legacy si existe
  await prisma.channel.updateMany({
    where: { slug: 'demo-tech' },
    data: { isActive: false },
  });

  // Desactivar canal tech legacy si existe
  await prisma.channel.updateMany({
    where: { slug: 'demo-tech' },
    data: { isActive: false },
  });

  const fraudChannel = await prisma.channel.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'fraude-corporativo',
      },
    },
    create: {
      organizationId: organization.id,
      name: 'El Fraude Silencioso',
      slug: 'fraude-corporativo',
      niche: 'escándalos corporativos y fraude empresarial',
      config: FRAUDE_CORPORATIVO_CONFIG,
      isActive: true,
    },
    update: {
      name: 'El Fraude Silencioso',
      niche: 'escándalos corporativos y fraude empresarial',
      config: FRAUDE_CORPORATIVO_CONFIG,
      isActive: true,
    },
  });

  // Normalizar duración mínima a 8 min en todos los canales (corrige configs antiguas con 600s)
  const allChannels = await prisma.channel.findMany({ select: { id: true, config: true } });
  for (const ch of allChannels) {
    const cfg = (ch.config ?? {}) as Record<string, unknown>;
    if (cfg.targetDurationMinSec === 480 && cfg.targetDurationMaxSec === 900) continue;
    await prisma.channel.update({
      where: { id: ch.id },
      data: {
        config: {
          ...cfg,
          targetDurationMinSec: 480,
          targetDurationMaxSec: cfg.targetDurationMaxSec ?? 900,
        },
      },
    });
  }

  await bindChannelPrompts(channel.id, {
    idea_generation: '1.8.0',
    script_generation: '2.1.0',
    hook_ab: '1.0.0',
  });

  await bindChannelPrompts(fraudChannel.id, {
    idea_generation: '1.8.1',
    script_generation: '2.0.1',
    hook_ab: '1.0.0',
  });

  const trends = [
    { niche: 'historia y curiosidades del mundo', topic: 'Civilizaciones antiguas olvidadas', score: 0.91 },
    { niche: 'historia y curiosidades del mundo', topic: 'Hechos históricos que parecen inventados', score: 0.89 },
    { niche: 'historia y curiosidades del mundo', topic: 'Misterios sin resolver de la historia', score: 0.87 },
    { niche: 'escándalos corporativos y fraude empresarial', topic: 'Honey y la investigación de MegaLag sobre la adquisición por PayPal (~4.000M)', score: 0.92 },
    { niche: 'escándalos corporativos y fraude empresarial', topic: 'Theranos: el fraude de Elizabeth Holmes y la sentencia federal (SEC)', score: 0.91 },
    { niche: 'escándalos corporativos y fraude empresarial', topic: 'WeWork: el S-1 fallido y el colapso de la valoración', score: 0.9 },
    { niche: 'escándalos corporativos y fraude empresarial', topic: 'Fyre Festival: el fraude de Billy McFarland y su condena', score: 0.89 },
    { niche: 'escándalos corporativos y fraude empresarial', topic: 'Quibi: 1.750 millones perdidos y el cierre documentado', score: 0.88 },
  ];

  for (const t of trends) {
    await prisma.trendSnapshot.create({ data: t });
  }

  console.log('Seed completed:', {
    organizationId: organization.id,
    adminEmail,
    channels: [
      { channelId: channel.id, slug: channel.slug, name: channel.name },
      { channelId: fraudChannel.id, slug: fraudChannel.slug, name: fraudChannel.name },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { prisma } from '@autotube/database';
import { extractIdeasArray, getLlmClient } from '@autotube/llm';
import { promptEngine } from '@autotube/prompt-engine';
import { getViralHookGuidelines, rankIdeas, selectTopIdea } from '@autotube/content-scorer';
import type { ContentScoreBreakdown } from '@autotube/shared';
import {
  buildChannelPromptContext,
  clampYouTubeTitle,
  formatDurationRange,
  getHistoryViralTopicAngles,
  getMinScriptWords,
  getRetentionIdeaHints,
  getRetentionViralGuidelines,
  getTargetDurationMaxSec,
  getTargetDurationMinSec,
  isHistoryNiche,
} from '@autotube/shared';
import { getIdeaMaxRetries } from '@autotube/config';
import type { ChannelConfig, VideoIdeaDTO } from '@autotube/shared';
import {
  fetchUsedTopics,
  formatUsedTopicsConstraint,
  isTopicDuplicate,
} from './used-topics.js';

interface LlmIdeaItem {
  title: string;
  hook: string;
  angle: string;
  targetAudience: string;
  trendAlignment: number;
  rationale?: string;
}

type RankedIdea = VideoIdeaDTO & { viralScore: number; scoreBreakdown: ContentScoreBreakdown };

async function fetchTrends(niche: string): Promise<string> {
  const trends = await prisma.trendSnapshot.findMany({
    where: { niche },
    orderBy: { fetchedAt: 'desc' },
    take: 5,
  });

  if (trends.length === 0) {
    return 'Sin tendencias — usar ángulos evergreen del nicho';
  }

  return trends.map((t) => `${t.topic} (score: ${t.score})`).join('; ');
}

function pickGlobalBest(current: RankedIdea | null, candidate: RankedIdea | undefined): RankedIdea | null {
  if (!candidate) return current;
  if (!current || candidate.viralScore > current.viralScore) return candidate;
  return current;
}

const FORCED_TOPIC_STOPWORDS = new Set([
  'que',
  'una',
  'uno',
  'unos',
  'unas',
  'del',
  'las',
  'los',
  'por',
  'para',
  'con',
  'sin',
  'como',
  'sobre',
  'entre',
  'the',
  'and',
]);

function tokenizeTopic(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FORCED_TOPIC_STOPWORDS.has(w));
}

/** Overlap de tokens entre tema forzado e idea (0–1). */
export function forcedTopicMatchScore(
  idea: { title: string; hook: string; angle: string },
  forcedTopic: string,
): number {
  const topicTokens = tokenizeTopic(forcedTopic);
  if (topicTokens.length === 0) return 0;
  const haystack = tokenizeTopic(`${idea.title} ${idea.hook} ${idea.angle}`);
  const set = new Set(haystack);
  let hits = 0;
  for (const t of topicTokens) {
    if (set.has(t)) hits += 1;
  }
  return hits / topicTokens.length;
}

async function selectForcedTopicIdea(
  pipelineRunId: string,
  forcedTopic: string,
): Promise<Awaited<ReturnType<typeof selectBestIdea>>> {
  const ideas = await prisma.videoIdea.findMany({ where: { pipelineRunId } });
  if (ideas.length === 0) return null;

  let best = ideas[0]!;
  let bestScore = forcedTopicMatchScore(best, forcedTopic);
  for (const idea of ideas.slice(1)) {
    const score = forcedTopicMatchScore(idea, forcedTopic);
    if (
      score > bestScore ||
      (score === bestScore && idea.viralScore > best.viralScore)
    ) {
      best = idea;
      bestScore = score;
    }
  }

  // Exigir señal mínima (p.ej. "dreux"+"1560" o título cercano).
  if (bestScore < 0.25) return null;

  await prisma.videoIdea.updateMany({
    where: { pipelineRunId },
    data: { isSelected: false },
  });
  await prisma.videoIdea.update({
    where: { id: best.id },
    data: { isSelected: true },
  });

  console.info(
    `[idea-generator] Tema forzado → idea "${best.title.slice(0, 60)}" (match=${bestScore.toFixed(2)})`,
  );
  return best;
}

async function persistSelectedIdea(
  pipelineRunId: string,
  idea: RankedIdea,
  replaceExisting: boolean,
) {
  if (replaceExisting) {
    await prisma.videoIdea.deleteMany({ where: { pipelineRunId } });
  } else {
    await prisma.videoIdea.updateMany({
      where: { pipelineRunId },
      data: { isSelected: false },
    });
  }

  return prisma.videoIdea.create({
    data: {
      pipelineRunId,
      title: idea.title,
      hook: idea.hook,
      angle: idea.angle,
      targetAudience: idea.targetAudience,
      trendAlignment: idea.trendAlignment,
      viralScore: idea.viralScore,
      rationale: idea.rationale,
      scoreBreakdown: idea.scoreBreakdown as object,
      isSelected: true,
    },
  });
}

export async function generateIdeas(params: {
  channelId: string;
  pipelineRunId: string;
  config: ChannelConfig;
  attempt?: number;
  replaceExisting?: boolean;
  usedTopics?: string[];
}): Promise<RankedIdea[]> {
  const attempt = params.attempt ?? 0;
  const minViralScore = params.config.minViralScore ?? 0;
  const trends = await fetchTrends(params.config.niche);
  const usedTopics =
    params.usedTopics ??
    (await fetchUsedTopics(params.channelId, params.pipelineRunId));

  const ideaCount = Math.min(
    15,
    params.config.ideasPerRun + (attempt > 0 ? attempt * 2 : 0),
  );

  const rendered = await promptEngine.render({
    channelId: params.channelId,
    type: 'idea_generation',
    variables: {
      count: ideaCount,
      niche: params.config.niche,
      format: params.config.videoFormat,
      language: params.config.language,
      trends,
      minViralScore: minViralScore > 0 ? minViralScore : 'alto',
      usedTopics:
        usedTopics.length > 0
          ? usedTopics.slice(0, 30).join('; ')
          : 'ninguno',
    },
  });

  const run = await prisma.pipelineRun.findUnique({ where: { id: params.pipelineRunId } });
  const forcedTopic =
    typeof (run?.metadata as Record<string, unknown> | null)?.forcedTopic === 'string'
      ? String((run?.metadata as Record<string, unknown>).forcedTopic)
      : undefined;

  const topicConstraint = forcedTopic
    ? ` TEMA OBLIGATORIO: todas las ideas deben ser sobre "${forcedTopic}" (historia, origen, impacto o curiosidades).`
    : '';

  const usedConstraint = formatUsedTopicsConstraint(usedTopics);

  const llm = getLlmClient();
  const format = params.config.videoFormat;
  const baseHint =
    params.config.language === 'es' || params.config.language.startsWith('es-')
      ? format === 'long'
        ? `OBLIGATORIO: ideas en español. Una curiosidad histórica con material para ${formatDurationRange(getTargetDurationMinSec(params.config), getTargetDurationMaxSec(params.config))} de documental (~${getMinScriptWords(params.config)}+ palabras de guion). Prohibido listas y temas superficiales.`
        : 'OBLIGATORIO: ideas íntegramente en español. Una sola curiosidad por idea — prohibido listas tipo "5 cosas".'
      : `Language: ${params.config.language}. Format: ${format}. One curiosity per video.`;

  const viralGuidelines = getViralHookGuidelines(minViralScore);
  const retentionHints = params.config.retentionMode
    ? `\n\n${getRetentionIdeaHints()}\n${getRetentionViralGuidelines()}`
    : '';
  const channelContext = buildChannelPromptContext(params.config);
  const historyAngles =
    params.config.retentionMode || isHistoryNiche(params.config.niche)
      ? `\n\n${getHistoryViralTopicAngles()}`
      : '';
  const retryHint =
    attempt > 0
      ? ` REINTENTO ${attempt}: la tanda anterior no alcanzó score mínimo${minViralScore > 0 ? ` (${minViralScore})` : ''}. Hooks más agresivos, más específicos y con mayor trendAlignment.`
      : '';

  const raw = await llm.completeJson<unknown>(
    rendered.content,
    `${baseHint}${topicConstraint}${usedConstraint}${channelContext}${historyAngles}${retryHint}${retentionHints}\n\n${viralGuidelines}\n\nJSON conciso con clave "ideas". Max 60 chars en title y hook.`,
  );

  const ideaItems = extractIdeasArray(raw) as unknown as LlmIdeaItem[];

  let ranked = rankIdeas(
    ideaItems.map((i) => ({
      title: clampYouTubeTitle(String(i.title)),
      hook: String(i.hook),
      angle: String(i.angle),
      targetAudience: String(i.targetAudience),
      trendAlignment: Number(i.trendAlignment) || 0.5,
      rationale: i.rationale ?? 'Generado por IA',
    })),
  );

  const beforeFilter = ranked.length;
  ranked = ranked.filter((idea) => !isTopicDuplicate(idea.title, usedTopics));
  if (beforeFilter > ranked.length) {
    console.info(
      `[idea-generator] Filtradas ${beforeFilter - ranked.length} ideas duplicadas de temas ya usados`,
    );
  }

  if (params.replaceExisting) {
    await prisma.videoIdea.deleteMany({ where: { pipelineRunId: params.pipelineRunId } });
  }

  if (ranked.length > 0) {
    await prisma.videoIdea.createMany({
      data: ranked.map((idea) => ({
        pipelineRunId: params.pipelineRunId,
        title: idea.title,
        hook: idea.hook,
        angle: idea.angle,
        targetAudience: idea.targetAudience,
        trendAlignment: idea.trendAlignment,
        viralScore: idea.viralScore,
        rationale: idea.rationale,
        scoreBreakdown: idea.scoreBreakdown as object,
      })),
    });
  }

  return ranked;
}

export async function selectBestIdea(params: {
  pipelineRunId: string;
  minViralScore?: number;
}) {
  const minViralScore = params.minViralScore ?? 0;
  const ideas = await prisma.videoIdea.findMany({
    where: { pipelineRunId: params.pipelineRunId },
    orderBy: { viralScore: 'desc' },
  });

  if (ideas.length === 0) return null;

  const best =
    minViralScore > 0 ? selectTopIdea(ideas, minViralScore) : ideas[0];
  if (!best) return null;
  await prisma.videoIdea.updateMany({
    where: { pipelineRunId: params.pipelineRunId },
    data: { isSelected: false },
  });
  await prisma.videoIdea.update({
    where: { id: best.id },
    data: { isSelected: true },
  });

  return best;
}

export async function ensureSelectedIdea(params: {
  channelId: string;
  pipelineRunId: string;
  config: ChannelConfig;
}) {
  const minViralScore = params.config.minViralScore ?? 0;
  const maxRetries = getIdeaMaxRetries(params.config.maxIdeaRetries);
  const usedTopics = await fetchUsedTopics(params.channelId, params.pipelineRunId);

  const runMeta = await prisma.pipelineRun.findUnique({
    where: { id: params.pipelineRunId },
    select: { metadata: true },
  });
  const forcedTopic =
    typeof (runMeta?.metadata as Record<string, unknown> | null)?.forcedTopic === 'string'
      ? String((runMeta?.metadata as Record<string, unknown>).forcedTopic)
      : null;

  // Tema forzado: elegir la idea alineada, sin gate de viral score.
  if (forcedTopic) {
    const matched = await selectForcedTopicIdea(params.pipelineRunId, forcedTopic);
    if (matched) return matched;
  }

  let globalBest: RankedIdea | null = null;

  const firstBatch = await prisma.videoIdea.findMany({
    where: { pipelineRunId: params.pipelineRunId },
    orderBy: { viralScore: 'desc' },
  });
  if (firstBatch[0]) {
    globalBest = pickGlobalBest(globalBest, {
      title: firstBatch[0].title,
      hook: firstBatch[0].hook,
      angle: firstBatch[0].angle,
      targetAudience: firstBatch[0].targetAudience,
      trendAlignment: firstBatch[0].trendAlignment,
      viralScore: firstBatch[0].viralScore,
      rationale: firstBatch[0].rationale,
      scoreBreakdown: firstBatch[0].scoreBreakdown as unknown as ContentScoreBreakdown,
    });
  }

  let idea = await selectBestIdea({ pipelineRunId: params.pipelineRunId, minViralScore });
  if (idea || minViralScore <= 0) return idea;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const previousBest = globalBest?.viralScore;

    console.info(
      `[idea-generator] Score < ${minViralScore} (mejor global: ${previousBest ?? '—'}). Reintento ${attempt}/${maxRetries}`,
    );

    const ranked = await generateIdeas({
      ...params,
      attempt,
      replaceExisting: true,
      usedTopics,
    });

    globalBest = pickGlobalBest(globalBest, ranked[0]);

    const run = await prisma.pipelineRun.findUnique({ where: { id: params.pipelineRunId } });
    const meta = (run?.metadata as Record<string, unknown> | null) ?? {};
    await prisma.pipelineRun.update({
      where: { id: params.pipelineRunId },
      data: {
        metadata: {
          ...meta,
          ideaAttempt: attempt,
          lastBestViralScore: ranked[0]?.viralScore ?? previousBest,
          globalBestViralScore: globalBest?.viralScore,
        },
      },
    });

    idea = await selectBestIdea({ pipelineRunId: params.pipelineRunId, minViralScore });
    if (idea) return idea;
  }

  if (globalBest) {
    console.warn(
      `[idea-generator] Tras ${maxRetries} reintentos ninguna idea ≥ ${minViralScore}. Usando la de mayor puntuación (${globalBest.viralScore}).`,
    );

    const selected = await persistSelectedIdea(params.pipelineRunId, globalBest, true);

    const run = await prisma.pipelineRun.findUnique({ where: { id: params.pipelineRunId } });
    const meta = (run?.metadata as Record<string, unknown> | null) ?? {};
    await prisma.pipelineRun.update({
      where: { id: params.pipelineRunId },
      data: {
        metadata: {
          ...meta,
          ideaBelowMinimum: true,
          minViralScore,
          selectedViralScore: globalBest.viralScore,
        },
      },
    });

    return selected;
  }

  return null;
}

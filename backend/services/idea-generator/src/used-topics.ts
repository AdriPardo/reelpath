import { prisma } from '@autotube/database';

/** Títulos de ideas/vídeos ya producidos en el canal (para no repetir). */
export async function fetchUsedTopics(
  channelId: string,
  excludePipelineRunId: string,
): Promise<string[]> {
  const [selectedIdeas, videos] = await Promise.all([
    prisma.videoIdea.findMany({
      where: {
        isSelected: true,
        pipelineRun: { channelId, id: { not: excludePipelineRunId } },
      },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.video.findMany({
      where: {
        channelId,
        reviewStatus: { not: 'rejected' },
        pipelineRunId: { not: excludePipelineRunId },
      },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
  ]);

  const seen = new Set<string>();
  const topics: string[] = [];

  for (const row of [...selectedIdeas, ...videos]) {
    const title = row.title.trim();
    if (!title) continue;
    const key = normalizeTopicKey(title);
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(title);
  }

  return topics;
}

export function normalizeTopicKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTopicDuplicate(title: string, usedTopics: string[]): boolean {
  const key = normalizeTopicKey(title);
  if (!key) return false;
  return usedTopics.some((used) => {
    const usedKey = normalizeTopicKey(used);
    if (!usedKey) return false;
    return key === usedKey || key.includes(usedKey) || usedKey.includes(key);
  });
}

export function formatUsedTopicsConstraint(usedTopics: string[]): string {
  if (usedTopics.length === 0) return '';

  const list = usedTopics
    .slice(0, 40)
    .map((t) => `- ${t}`)
    .join('\n');

  const more =
    usedTopics.length > 40
      ? `\n… y ${usedTopics.length - 40} temas más.`
      : '';

  return `

TEMAS YA USADOS EN ESTE CANAL (PROHIBIDO repetir, parafrasear o hacer variación mínima):
${list}${more}
Genera ideas sobre curiosidades históricas DISTINTAS — otro personaje, evento, lugar o ángulo narrativo.`;
}

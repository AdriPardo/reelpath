import { prisma } from '@autotube/database';

export async function getOrgChannelIds(orgId: string): Promise<string[]> {
  const channels = await prisma.channel.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  return channels.map((c) => c.id);
}

export async function assertChannelInOrg(channelId: string, orgId: string): Promise<boolean> {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId: orgId },
    select: { id: true },
  });
  return !!channel;
}

export async function assertVideoInOrg(videoId: string, orgId: string): Promise<boolean> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { channelId: true },
  });
  if (!video) return false;
  return assertChannelInOrg(video.channelId, orgId);
}

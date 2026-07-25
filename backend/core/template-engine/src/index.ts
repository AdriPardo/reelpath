import { prisma } from '@autotube/database';
import {
  inferMotionPreset,
  inferTransitionPreset,
  resolveSceneMotionIntensity,
  type MediaAssetDTO,
  type MotionPreset,
  type ScriptVariant,
  type TimelineClip,
  type VideoMotionIntensity,
  type VideoTemplate,
} from '@autotube/shared';

export interface BuildTimelineOptions {
  videoMotionIntensity?: VideoMotionIntensity;
  retentionMode?: boolean;
}

export class TemplateRegistry {
  async getTemplate(templateId: string): Promise<VideoTemplate> {
    const record = await prisma.videoTemplateRecord.findUnique({ where: { id: templateId } });
    if (!record) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return { id: record.id, name: record.name, ...(record.config as Omit<VideoTemplate, 'id' | 'name'>) };
  }

  buildTimeline(
    script: ScriptVariant,
    assets: MediaAssetDTO[],
    options?: BuildTimelineOptions,
  ): TimelineClip[] {
    const clips: TimelineClip[] = [];
    let startSec = 0;
    let previousPreset: MotionPreset | undefined;

    for (const scene of script.scenes) {
      const video = assets.find((a) => a.sceneIndex === scene.index && a.type === 'video');
      const image = assets.find((a) => a.sceneIndex === scene.index && a.type === 'image');
      const audio = assets.find((a) => a.sceneIndex === scene.index && a.type === 'audio');
      const sceneSubtitle = assets.find(
        (a) => a.sceneIndex === scene.index && a.type === 'subtitle',
      );

      const visualMeta = video?.metadata ?? image?.metadata;

      const durationSec =
        Number(audio?.metadata?.durationSec) ||
        Number(visualMeta?.durationSec) ||
        scene.durationSec;

      const motionIntensity = resolveSceneMotionIntensity({
        sceneIndex: scene.index,
        durationSec,
        channelIntensity: options?.videoMotionIntensity,
        retentionMode: options?.retentionMode,
      });

      const motionPreset = inferMotionPreset({
        sceneIndex: scene.index,
        narration: scene.narration,
        visualPrompt: scene.visualPrompt,
        previousPreset,
        durationSec,
        videoMotionIntensity: options?.videoMotionIntensity,
        retentionMode: options?.retentionMode,
      });
      previousPreset = motionPreset;

      clips.push({
        sceneIndex: scene.index,
        startSec,
        durationSec,
        narration: scene.narration,
        videoPath: video?.path,
        imagePath: image?.path,
        audioPath: audio?.path,
        subtitlePath: sceneSubtitle?.path,
        motionPreset,
        motionIntensity,
        transitionToNext: inferTransitionPreset(scene.index, scene.transitionPreset),
        preferredVisualSource: scene.preferredVisualSource,
      });

      startSec += durationSec;
    }

    return clips;
  }
}

export const templateRegistry = new TemplateRegistry();

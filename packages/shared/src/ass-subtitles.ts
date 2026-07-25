function formatAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

/**
 * ASS con karaoke (\kf) para resaltar la palabra activa durante el burn-in.
 * SecondaryColour (amarillo) se rellena progresivamente sobre PrimaryColour (blanco).
 */
export function buildKaraokeAssForScene(
  narration: string,
  durationSec: number,
  options?: { fontSize?: number; alignment?: number; marginV?: number },
): string {
  const words = narration.trim().split(/\s+/).filter(Boolean);
  const fontSize = options?.fontSize ?? 42;
  const alignment = options?.alignment ?? 2;
  const marginV = options?.marginV ?? 64;

  if (words.length === 0 || durationSec <= 0) {
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H00111111,&H66000000,1,0,0,0,100,100,0.4,0,3,1.8,0,${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  }

  const totalCs = Math.max(words.length, Math.floor(durationSec * 100));
  const weightTotal = words.reduce((sum, w) => sum + Math.max(w.length, 1), 0);
  const karaokeParts = words.map((word) => {
    const cs = Math.max(1, Math.round((Math.max(word.length, 1) / weightTotal) * totalCs));
    return `{\\kf${cs}}${escapeAssText(word)}`;
  });

  const dialogue = karaokeParts.join(' ');
  const endTime = formatAssTime(durationSec);

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H00111111,&H66000000,1,0,0,0,100,100,0.4,0,3,1.8,0,${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${endTime},Default,,0,0,0,,${dialogue}
`;
}

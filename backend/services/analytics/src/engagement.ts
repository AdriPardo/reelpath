/** Prefer view-weighted mean so high-traffic videos dominate. */
export function averageEngagement(
  rows: Array<{ views: number; ctr: number; retention: number }>,
): { avgCtr: number | null; avgRetention: number | null; sampleCount: number } {
  const withSignal = rows.filter((r) => r.ctr > 0 || r.retention > 0);
  if (withSignal.length === 0) {
    return { avgCtr: null, avgRetention: null, sampleCount: 0 };
  }

  const weightSum = withSignal.reduce((s, r) => s + Math.max(r.views, 1), 0);
  const avgCtr =
    withSignal.reduce((s, r) => s + r.ctr * Math.max(r.views, 1), 0) / weightSum;
  const avgRetention =
    withSignal.reduce((s, r) => s + r.retention * Math.max(r.views, 1), 0) / weightSum;

  return {
    avgCtr,
    avgRetention,
    sampleCount: withSignal.length,
  };
}

/** Arithmetic mean. Returns 0 for an empty list. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n-1). Returns 0 for fewer than two points. */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Pearson product-moment correlation coefficient of two equal-length series. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  r: number;
  r2: number;
  predict: (x: number) => number;
}

/** Ordinary least-squares fit of y on x. */
export function linearRegression(xs: number[], ys: number[]): LinearFit {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) {
    return { slope: 0, intercept: ys[0] ?? 0, r: 0, r2: 0, predict: () => ys[0] ?? 0 };
  }
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const r = pearson(xs.slice(0, n), ys.slice(0, n));
  return {
    slope,
    intercept,
    r,
    r2: r * r,
    predict: (x: number) => slope * x + intercept,
  };
}

/** z-score of a value within a population. */
export function zScore(value: number, population: number[]): number {
  const sd = stdDev(population);
  if (sd === 0) return 0;
  return (value - mean(population)) / sd;
}

/**
 * Percentile rank (0-100) of a value within a population, where 100 is the
 * best. When higherIsBetter is false (times), the ranking is inverted so that
 * a faster time still yields a higher percentile.
 */
export function percentileRank(
  value: number,
  population: number[],
  higherIsBetter: boolean,
): number {
  if (population.length === 0) return 50;
  const better = population.filter((p) =>
    higherIsBetter ? p < value : p > value,
  ).length;
  const equal = population.filter((p) => p === value).length;
  return ((better + 0.5 * equal) / population.length) * 100;
}

/** Qualitative strength label for a correlation coefficient. */
export function correlationStrength(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "negligible";
}

export function round(value: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

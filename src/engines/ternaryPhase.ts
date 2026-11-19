import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface TernaryComp {
  a: number;
  b: number;
  c: number;
}

export interface TieLine {
  raffinate: TernaryComp;
  extract: TernaryComp;
}

export interface TernaryResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  mixture: TernaryComp | null;
  regime: 'Single-Phase Homogeneous' | 'Two-Phase Immiscible' | null;
  activeTieLine: TieLine | null;
  binodalCurve: TernaryComp[];
  tieLines: TieLine[];
  plaitPoint: TernaryComp;
}

function binodalAtU(u: number, tempC: number): TernaryComp {
  const clampedU = Math.max(0, Math.min(1, u));
  const tShift = tempC - 20;
  const hMax = Math.max(0.16, Math.min(0.55, 0.43 - 0.0028 * tShift));
  const c0 = Math.max(0.008, Math.min(0.15, 0.018 + 0.0012 * tShift));
  const c1 = Math.min(0.992, Math.max(0.85, 0.982 - 0.0014 * tShift));

  const b = hMax * Math.pow(Math.sin(Math.PI * clampedU), 0.85) * (1 - 0.14 * clampedU);
  const cBase = c0 + clampedU * (c1 - c0);
  const c = (1 - b) * cBase;
  const a = Math.max(0, 1 - b - c);
  return {a, b, c};
}

function tieEndpointsForFrac(t: number, tempC: number): TieLine {
  // t in (0, 1): 0 is bottom baseline (pure A-C), 1 approaches plait point
  const uR = 0.02 + 0.42 * t;
  const uE = 0.98 - 0.44 * t;
  return {
    raffinate: binodalAtU(uR, tempC),
    extract: binodalAtU(uE, tempC),
  };
}

function buildTernaryGeometry(tempC: number) {
  const binodalCurve: TernaryComp[] = [];
  for (let i = 0; i <= 60; i++) {
    binodalCurve.push(binodalAtU(i / 60, tempC));
  }
  const tieLines: TieLine[] = [0.08, 0.28, 0.5, 0.72, 0.88].map((t) => tieEndpointsForFrac(t, tempC));
  const plaitPoint = binodalAtU(0.54, tempC);
  return {binodalCurve, tieLines, plaitPoint};
}

export function calculateTernaryPhase(raw: Record<string, number | string>): TernaryResult {
  const rawA = Number(raw.fracA);
  const rawB = Number(raw.fracB);
  const rawC = Number(raw.fracC);
  const tempC = Number(raw.tempC);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(rawA) || rawA < 0) {
    issues.push({field: 'fracA', message: 'Component A (Carrier) must be ≥ 0.', severity: 'error'});
  }
  if (!Number.isFinite(rawB) || rawB < 0) {
    issues.push({field: 'fracB', message: 'Component B (Solute) must be ≥ 0.', severity: 'error'});
  }
  if (!Number.isFinite(rawC) || rawC < 0) {
    issues.push({field: 'fracC', message: 'Component C (Solvent) must be ≥ 0.', severity: 'error'});
  }
  if (!Number.isFinite(tempC) || tempC < 5 || tempC > 75) {
    issues.push({
      field: 'tempC',
      message: 'System temperature must be between 5 °C and 75 °C.',
      severity: 'error',
    });
  }

  const safeTemp = Number.isFinite(tempC) ? Math.max(5, Math.min(75, tempC)) : 25;
  const geom = buildTernaryGeometry(safeTemp);

  if (issues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      issues,
      outputs: [],
      mixture: null,
      regime: null,
      activeTieLine: null,
      ...geom,
    };
  }

  const sum = rawA + rawB + rawC;
  if (sum <= 0) {
    issues.push({
      field: 'fracA',
      message: 'Sum of component fractions must be > 0.',
      severity: 'error',
    });
    return {
      valid: false,
      issues,
      outputs: [],
      mixture: null,
      regime: null,
      activeTieLine: null,
      ...geom,
    };
  }

  if (Math.abs(sum - 1) > 0.005) {
    issues.push({
      field: 'fracC',
      message: `Input fractions sum to ${sum.toFixed(3)}; automatically normalized to unity (1.000) for barycentric projection.`,
      severity: 'warning',
    });
  }

  const mix: TernaryComp = {
    a: rawA / sum,
    b: rawB / sum,
    c: rawC / sum,
  };

  // Find u where binodal's c/(a+c) matches mix's c/(a+c)
  const ratioMix = mix.a + mix.c > 1e-6 ? mix.c / (mix.a + mix.c) : 0.5;
  const tShift = safeTemp - 20;
  const c0 = Math.max(0.008, Math.min(0.15, 0.018 + 0.0012 * tShift));
  const c1 = Math.min(0.992, Math.max(0.85, 0.982 - 0.0014 * tShift));
  const uAlong = (ratioMix - c0) / (c1 - c0);

  let twoPhase = false;
  let activeTieLine: TieLine | null = null;
  let extractSplit = 0;

  if (uAlong > 0 && uAlong < 1) {
    const bound = binodalAtU(uAlong, safeTemp);
    if (mix.b < bound.b) {
      twoPhase = true;
      // Solve t in [0, 1] such that mix lies on tie-line (raffinate(t) -> extract(t))
      // Check signed distance in (c, b) plane
      let bestT = 0.2;
      let minDist = Infinity;
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const tl = tieEndpointsForFrac(t, safeTemp);
        const dc = tl.extract.c - tl.raffinate.c;
        const db = tl.extract.b - tl.raffinate.b;
        const len2 = dc * dc + db * db;
        if (len2 < 1e-9) continue;
        const proj = ((mix.c - tl.raffinate.c) * dc + (mix.b - tl.raffinate.b) * db) / len2;
        if (proj >= 0 && proj <= 1) {
          const pc = tl.raffinate.c + proj * dc;
          const pb = tl.raffinate.b + proj * db;
          const d = Math.hypot(mix.c - pc, mix.b - pb);
          if (d < minDist) {
            minDist = d;
            bestT = t;
            extractSplit = proj;
          }
        }
      }
      activeTieLine = tieEndpointsForFrac(bestT, safeTemp);
    }
  }

  const regime = twoPhase ? 'Two-Phase Immiscible' : 'Single-Phase Homogeneous';
  const kd =
    activeTieLine && activeTieLine.raffinate.b > 1e-4
      ? activeTieLine.extract.b / activeTieLine.raffinate.b
      : null;

  const outputs: OutputMetric[] = [
    {
      id: 'regime',
      label: 'Phase Region',
      symbol: 'Regime',
      value: regime,
      formatted: regime,
      unit: '',
      status: twoPhase ? 'warning' : 'nominal',
      statusLabel: twoPhase ? 'Phase Split' : 'Miscible',
      finePrint:
        'Mixtures beneath the binodal dome split into conjugated Raffinate (A-rich) and Extract (C-rich) phases connected by a tie-line.',
    },
    {
      id: 'normalized',
      label: 'Normalized Feed (A / B / C)',
      symbol: 'z_i',
      value: `${mix.a.toFixed(3)} / ${mix.b.toFixed(3)} / ${mix.c.toFixed(3)}`,
      formatted: `${(mix.a * 100).toFixed(1)}% / ${(mix.b * 100).toFixed(1)}% / ${(mix.c * 100).toFixed(1)}%`,
      unit: 'wt/mol',
      finePrint: 'Barycentric coordinates satisfying x_A + x_B + x_C = 1.000 on the equilateral triangle.',
    },
    {
      id: 'raffinate',
      label: 'Raffinate Composition (A-rich)',
      symbol: 'x_R',
      value: activeTieLine ? activeTieLine.raffinate.b : null,
      formatted: activeTieLine
        ? `${(activeTieLine.raffinate.a * 100).toFixed(1)}% / ${(activeTieLine.raffinate.b * 100).toFixed(1)}% / ${(activeTieLine.raffinate.c * 100).toFixed(1)}%`
        : 'N/A (Single Phase)',
      unit: activeTieLine ? 'A/B/C' : '',
      finePrint: 'Equilibrium composition at the left binodal endpoint of the tie-line passing through the feed mixture.',
    },
    {
      id: 'extract',
      label: 'Extract Composition (C-rich)',
      symbol: 'y_E',
      value: activeTieLine ? activeTieLine.extract.b : null,
      formatted: activeTieLine
        ? `${(activeTieLine.extract.a * 100).toFixed(1)}% / ${(activeTieLine.extract.b * 100).toFixed(1)}% / ${(activeTieLine.extract.c * 100).toFixed(1)}%`
        : 'N/A (Single Phase)',
      unit: activeTieLine ? 'A/B/C' : '',
      finePrint: activeTieLine
        ? `Lever-rule extract split: ${(extractSplit * 100).toFixed(1)}% Extract / ${((1 - extractSplit) * 100).toFixed(1)}% Raffinate (K_D = ${kd?.toFixed(2) ?? '—'}).`
        : 'Only one uniform liquid phase exists above the binodal miscibility boundary.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    mixture: mix,
    regime,
    activeTieLine,
    ...geom,
  };
}

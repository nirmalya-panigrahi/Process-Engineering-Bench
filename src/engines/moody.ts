import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface MoodyCurveSeries {
  relRoughness: number;
  label: string;
  points: {re: number; f: number}[];
}

export interface MoodyResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  operatingPoint: {
    re: number;
    f: number;
    relRoughness: number;
    regime: string;
  } | null;
  laminarCurve: {re: number; f: number}[];
  roughnessCurves: MoodyCurveSeries[];
}

export function solveColebrookWhite(re: number, relRoughness: number): number {
  if (re <= 2300) {
    return 64 / re;
  }

  // Haaland explicit seed
  const term = Math.pow(relRoughness / 3.7, 1.11) + 6.9 / re;
  let invSqrtF = -1.8 * Math.log10(term);
  let f = 1 / (invSqrtF * invSqrtF);

  // Fixed-point Colebrook-White iteration
  for (let i = 0; i < 16; i++) {
    const rhs = -2 * Math.log10(relRoughness / 3.7 + 2.51 / (re * Math.sqrt(f)));
    const nextF = 1 / (rhs * rhs);
    if (Math.abs(nextF - f) < 1e-11) {
      f = nextF;
      break;
    }
    f = nextF;
  }
  return f;
}

export function darcyFrictionFactor(re: number, relRoughness: number): number {
  if (re <= 2300) {
    return 64 / re;
  }
  if (re < 4000) {
    // Smooth cubic blend across transitional band (2300 < Re < 4000)
    const fLam = 64 / 2300;
    const fTurb = solveColebrookWhite(4000, relRoughness);
    const t = (re - 2300) / (4000 - 2300);
    const smoothT = t * t * (3 - 2 * t);
    return fLam + smoothT * (fTurb - fLam);
  }
  return solveColebrookWhite(re, relRoughness);
}

function buildMoodyCurves() {
  const laminarCurve: {re: number; f: number}[] = [];
  for (let logRe = 2.7; logRe <= 3.3617; logRe += 0.05) {
    const re = Math.pow(10, logRe);
    laminarCurve.push({re, f: 64 / re});
  }
  laminarCurve.push({re: 2300, f: 64 / 2300});

  const relValues = [0, 0.00005, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05];
  const roughnessCurves: MoodyCurveSeries[] = relValues.map((epsD) => {
    const points: {re: number; f: number}[] = [];
    for (let logRe = 3.602; logRe <= 8.001; logRe += 0.1) {
      const re = Math.pow(10, Math.min(logRe, 8));
      points.push({re, f: solveColebrookWhite(re, epsD)});
    }
    return {
      relRoughness: epsD,
      label: epsD === 0 ? 'Smooth (0)' : epsD.toString(),
      points,
    };
  });

  return {laminarCurve, roughnessCurves};
}

export function calculateMoody(raw: Record<string, number | string>): MoodyResult {
  const re = Number(raw.reynolds);
  const diameterMm = Number(raw.diameterMm);
  const roughnessMm = Number(raw.roughnessMm);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(re) || re < 500 || re > 1e8) {
    issues.push({
      field: 'reynolds',
      message: 'Reynolds number must be between 500 and 1.0×10⁸.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(diameterMm) || diameterMm <= 0 || diameterMm > 10000) {
    issues.push({
      field: 'diameterMm',
      message: 'Pipe internal diameter must be > 0 mm and ≤ 10,000 mm.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(roughnessMm) || roughnessMm < 0 || roughnessMm > 50) {
    issues.push({
      field: 'roughnessMm',
      message: 'Wall roughness ε must be between 0 mm and 50 mm.',
      severity: 'error',
    });
  }

  const curves = buildMoodyCurves();

  if (issues.some((i) => i.severity === 'error')) {
    return {valid: false, issues, outputs: [], operatingPoint: null, ...curves};
  }

  const relRoughness = roughnessMm / diameterMm;
  if (relRoughness > 0.08) {
    issues.push({
      field: 'roughnessMm',
      message: 'Relative roughness ε/D > 0.08 exceeds standard Moody correlation bounds (0 to 0.05).',
      severity: 'error',
    });
    return {valid: false, issues, outputs: [], operatingPoint: null, ...curves};
  }

  if (relRoughness > 0.05) {
    issues.push({
      field: 'roughnessMm',
      message: 'Relative roughness ε/D > 0.05 is above plotted reference family; Colebrook-White extrapolated.',
      severity: 'warning',
    });
  }

  const f = darcyFrictionFactor(re, relRoughness);
  const fanningF = f / 4;
  const roughnessRe = re * Math.sqrt(f / 8) * relRoughness;

  let regime = 'Turbulent (Transitionally Rough)';
  let status: 'nominal' | 'warning' = 'nominal';
  let statusLabel = 'Deterministic';

  if (re <= 2300) {
    regime = 'Laminar (Hagen–Poiseuille)';
  } else if (re < 4000) {
    regime = 'Transitional (Unstable)';
    status = 'warning';
    statusLabel = 'Transitional Band';
    issues.push({
      field: 'reynolds',
      message: 'Re between 2,300 and 4,000 lies in the unstable transition zone; friction factor carries high experimental uncertainty.',
      severity: 'warning',
    });
  } else if (relRoughness === 0 || roughnessRe < 5) {
    regime = 'Turbulent (Hydraulically Smooth)';
  } else if (roughnessRe > 70) {
    regime = 'Turbulent (Fully Rough)';
  }

  const outputs: OutputMetric[] = [
    {
      id: 'darcyF',
      label: 'Darcy–Weisbach Friction Factor',
      symbol: 'f',
      value: f,
      formatted: f.toFixed(5),
      unit: '–',
      status,
      statusLabel,
      finePrint:
        'Computed via f = 64/Re for laminar (Re ≤ 2300) and implicit Colebrook–White equation solved to 10⁻¹¹ tolerance for turbulent flow (Re ≥ 4000).',
    },
    {
      id: 'fanningF',
      label: 'Fanning Friction Factor',
      symbol: 'f_F',
      value: fanningF,
      formatted: fanningF.toFixed(5),
      unit: '–',
      finePrint: 'Commonly used in chemical engineering piping correlations: f_F = f_Darcy / 4.',
    },
    {
      id: 'relRoughness',
      label: 'Relative Roughness',
      symbol: 'ε/D',
      value: relRoughness,
      formatted: relRoughness.toExponential(3),
      unit: '–',
      finePrint: 'Dimensionless ratio of absolute pipe wall roughness ε (mm) to internal diameter D (mm).',
    },
    {
      id: 'regime',
      label: 'Flow Regime',
      symbol: 'Regime',
      value: regime,
      formatted: regime,
      unit: '',
      status,
      statusLabel,
      finePrint:
        'Classified by Reynolds number and roughness Reynolds number Re* = Re·√(f/8)·(ε/D): smooth (<5), transitionally rough (5–70), fully rough (>70).',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    operatingPoint: {re, f, relRoughness, regime},
    ...curves,
  };
}

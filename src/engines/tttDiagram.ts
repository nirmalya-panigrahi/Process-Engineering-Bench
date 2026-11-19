import type {OutputMetric, ValidationIssue} from '../types/bench';

export type SteelGradeId = 'AISI-1045' | 'AISI-1080' | 'AISI-4140' | 'AISI-4340';
export type TttPathMode = 'isothermal' | 'continuous';

interface SteelGradeSpec {
  name: string;
  a1C: number;
  bsC: number;
  msC: number;
  m90C: number;
  noseTempC: number;
  noseTimeS: number;
  finishMult: number;
  maxHrc: number;
  baseHrc: number;
}

const STEEL_GRADES: Record<SteelGradeId, SteelGradeSpec> = {
  'AISI-1045': {
    name: 'AISI 1045 (0.45% C Plain)',
    a1C: 727,
    bsC: 560,
    msC: 340,
    m90C: 190,
    noseTempC: 550,
    noseTimeS: 0.7,
    finishMult: 9,
    maxHrc: 58,
    baseHrc: 18,
  },
  'AISI-1080': {
    name: 'AISI 1080 (0.80% C Eutectoid)',
    a1C: 727,
    bsC: 540,
    msC: 220,
    m90C: 85,
    noseTempC: 545,
    noseTimeS: 0.9,
    finishMult: 11,
    maxHrc: 65,
    baseHrc: 24,
  },
  'AISI-4140': {
    name: 'AISI 4140 (Cr-Mo Alloy)',
    a1C: 735,
    bsC: 550,
    msC: 335,
    m90C: 180,
    noseTempC: 620,
    noseTimeS: 6.5,
    finishMult: 14,
    maxHrc: 57,
    baseHrc: 22,
  },
  'AISI-4340': {
    name: 'AISI 4340 (Ni-Cr-Mo High Hardenability)',
    a1C: 725,
    bsC: 515,
    msC: 295,
    m90C: 140,
    noseTempC: 625,
    noseTimeS: 45,
    finishMult: 18,
    maxHrc: 58,
    baseHrc: 25,
  },
};

export interface TttCurvePoint {
  tS: number;
  tempC: number;
}

export interface TttResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  grade: SteelGradeSpec;
  startCurve: TttCurvePoint[];
  finishCurve: TttCurvePoint[];
  pathPoints: TttCurvePoint[];
  mode: TttPathMode;
}

function tStartAtTemp(grade: SteelGradeSpec, tempC: number): number {
  if (tempC >= grade.a1C - 5 || tempC <= grade.msC + 5) {
    return 1e6;
  }
  const distNorm = (tempC - grade.noseTempC) / 115;
  return grade.noseTimeS * Math.exp(2.05 * distNorm * distNorm);
}

function buildTttCurves(grade: SteelGradeSpec) {
  const startCurve: TttCurvePoint[] = [];
  const finishCurve: TttCurvePoint[] = [];
  for (let temp = grade.msC + 15; temp <= grade.a1C - 15; temp += 10) {
    const ts = tStartAtTemp(grade, temp);
    if (ts <= 100000) {
      startCurve.push({tS: ts, tempC: temp});
      finishCurve.push({tS: Math.min(120000, ts * grade.finishMult), tempC: temp});
    }
  }
  return {startCurve, finishCurve};
}

export function calculateTtt(raw: Record<string, number | string>): TttResult {
  const gradeId = ((raw.steelGrade as SteelGradeId) || 'AISI-1080') in STEEL_GRADES
    ? (raw.steelGrade as SteelGradeId)
    : 'AISI-1080';
  const grade = STEEL_GRADES[gradeId];
  const mode = ((raw.pathMode as TttPathMode) || 'isothermal');
  const holdTempC = Number(raw.holdTempC);
  const holdTimeS = Number(raw.holdTimeS);
  const coolingRateCS = Number(raw.coolingRateCS);

  const issues: ValidationIssue[] = [];
  if (mode === 'isothermal') {
    if (!Number.isFinite(holdTempC) || holdTempC < 20 || holdTempC > 720) {
      issues.push({
        field: 'holdTempC',
        message: 'Isothermal hold temperature must be between 20 °C and 720 °C.',
        severity: 'error',
      });
    }
    if (!Number.isFinite(holdTimeS) || holdTimeS < 0.1 || holdTimeS > 100000) {
      issues.push({
        field: 'holdTimeS',
        message: 'Isothermal hold time must be between 0.1 s and 100,000 s.',
        severity: 'error',
      });
    }
  } else {
    if (!Number.isFinite(coolingRateCS) || coolingRateCS < 0.05 || coolingRateCS > 500) {
      issues.push({
        field: 'coolingRateCS',
        message: 'Cooling rate must be between 0.05 °C/s and 500 °C/s.',
        severity: 'error',
      });
    }
  }

  const {startCurve, finishCurve} = buildTttCurves(grade);
  if (issues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      issues,
      outputs: [],
      grade,
      startCurve,
      finishCurve,
      pathPoints: [],
      mode,
    };
  }

  let pearlitePct = 0;
  let bainitePct = 0;
  let martensitePct = 0;
  let retainedAustenitePct = 0;
  let dominant = 'Pearlite';
  const pathPoints: TttCurvePoint[] = [];

  if (mode === 'isothermal') {
    // Rapid quench from 850°C to holdTempC in ~0.3s, then hold until holdTimeS
    pathPoints.push({tS: 0.1, tempC: 850});
    pathPoints.push({tS: 0.25, tempC: holdTempC});
    pathPoints.push({tS: holdTimeS, tempC: holdTempC});

    if (holdTempC <= grade.msC) {
      // Athermal martensite formation via Koistinen-Marburger
      const fM = 1 - Math.exp(-0.011 * (grade.msC - holdTempC));
      martensitePct = fM * 100;
      retainedAustenitePct = (1 - fM) * 100;
      dominant = martensitePct > 50 ? 'Martensite (Untempered)' : 'Austenite + Martensite';
    } else {
      const ts = tStartAtTemp(grade, holdTempC);
      const tf = ts * grade.finishMult;
      let transformed = 0;
      if (holdTimeS > ts) {
        const tau = (tf - ts) / 2.2;
        transformed = 1 - Math.exp(-Math.pow((holdTimeS - ts) / Math.max(0.1, tau), 1.6));
      }
      transformed = Math.max(0, Math.min(1, transformed));
      if (holdTempC >= grade.bsC) {
        pearlitePct = transformed * 100;
        dominant =
          holdTempC > 630 ? 'Coarse Pearlite' : 'Fine Pearlite';
      } else {
        bainitePct = transformed * 100;
        dominant =
          holdTempC > 430 ? 'Upper Bainite' : 'Lower Bainite';
      }
      const remaining = (1 - transformed) * 100;
      if (remaining > 1) {
        retainedAustenitePct = remaining;
        dominant = transformed < 0.05 ? 'Untransformed Austenite (Quench -> Martensite)' : `${dominant} + Untransformed γ`;
      }
    }
  } else {
    // Continuous cooling from 850°C at coolingRateCS (Scheil additivity approximation)
    const dt = 0.2;
    let scheilSum = 0;
    let avgTransformTemp = 0;
    let weightSum = 0;
    for (let t = 0.1; t <= 100000; t *= 1.18) {
      const temp = Math.max(25, 850 - coolingRateCS * t);
      pathPoints.push({tS: t, tempC: temp});
      if (temp <= 25) break;
    }

    // Fine linear integration between A1 and Ms for Scheil additivity
    const totalWindowSec = (grade.a1C - grade.msC) / coolingRateCS;
    const steps = 120;
    const stepSec = totalWindowSec / steps;
    for (let i = 0; i < steps; i++) {
      const temp = grade.a1C - ((i + 0.5) * (grade.a1C - grade.msC)) / steps;
      // CCT shift factor (~1.5x TTT nose time)
      const tsCct = tStartAtTemp(grade, temp) * 1.5;
      const contrib = stepSec / tsCct;
      scheilSum += contrib;
      avgTransformTemp += temp * contrib;
      weightSum += contrib;
    }

    const diffFrac = Math.min(1, Math.max(0, 1 - Math.exp(-Math.max(0, scheilSum - 0.15) * 1.4)));
    if (scheilSum < 0.65) {
      // Mostly martensite!
      const rem = Math.max(0, 1 - diffFrac);
      const fM = rem * (1 - Math.exp(-0.011 * (grade.msC - 25)));
      martensitePct = fM * 100;
      retainedAustenitePct = Math.max(0, (rem - fM) * 100);
      const meanT = weightSum > 0 ? avgTransformTemp / weightSum : grade.noseTempC;
      if (meanT >= grade.bsC) pearlitePct = diffFrac * 100;
      else bainitePct = diffFrac * 100;
      dominant = martensitePct > 75 ? 'Martensite (Full Quench)' : 'Martensite + Bainite/Pearlite';
    } else {
      const meanT = weightSum > 0 ? avgTransformTemp / weightSum : grade.noseTempC;
      if (meanT >= grade.bsC) {
        pearlitePct = diffFrac * 100;
        dominant = meanT > 630 ? 'Coarse Pearlite' : 'Fine Pearlite';
      } else {
        bainitePct = diffFrac * 100;
        dominant = 'Bainite';
      }
      const rem = (1 - diffFrac) * 100;
      martensitePct = rem * 0.9;
      retainedAustenitePct = rem * 0.1;
    }
  }

  // Estimate HRC hardness
  const hrc =
    (pearlitePct / 100) * (grade.baseHrc + 12) +
    (bainitePct / 100) * (grade.baseHrc + 24) +
    (martensitePct / 100) * grade.maxHrc +
    (retainedAustenitePct / 100) * 28;
  const hv = Math.round(180 + hrc * 9.5);

  const outputs: OutputMetric[] = [
    {
      id: 'microstructure',
      label: 'Resulting Microstructure',
      symbol: 'Phase',
      value: dominant,
      formatted: dominant,
      unit: '',
      finePrint: `${grade.name} with nose at ${grade.noseTempC} °C / ${grade.noseTimeS} s, B_s = ${grade.bsC} °C, and M_s = ${grade.msC} °C.`,
    },
    {
      id: 'phaseSplit',
      label: 'Phase Breakdown (P / B / M)',
      symbol: 'f_i',
      value: `${pearlitePct.toFixed(0)} / ${bainitePct.toFixed(0)} / ${martensitePct.toFixed(0)}`,
      formatted: `${pearlitePct.toFixed(0)}% / ${bainitePct.toFixed(0)}% / ${martensitePct.toFixed(0)}%`,
      unit: 'P/B/M',
      finePrint: `Avrami isothermal transformation & Koistinen–Marburger martensite model; remaining austenite = ${retainedAustenitePct.toFixed(1)}%.`,
    },
    {
      id: 'hardness',
      label: 'Estimated Hardness',
      symbol: 'HRC',
      value: hrc,
      formatted: `${hrc.toFixed(1)} HRC`,
      unit: `(${hv} HV)`,
      finePrint: 'Rule-of-mixtures hardness estimate across Pearlite, Bainite, and untempered Martensite fractions.',
    },
    {
      id: 'criticalTemps',
      label: 'Critical Temps (A₁ / M_s)',
      symbol: 'T_crit',
      value: `${grade.a1C} / ${grade.msC}`,
      formatted: `${grade.a1C} °C / ${grade.msC} °C`,
      unit: '',
      finePrint: 'A₁ is lower eutectoid transformation boundary; M_s is athermal martensite start temperature.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    grade,
    startCurve,
    finishCurve,
    pathPoints,
    mode,
  };
}

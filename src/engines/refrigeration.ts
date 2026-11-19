import type {OutputMetric, ValidationIssue} from '../types/bench';

export type RefrigerantId = 'R134a' | 'R410A' | 'R32' | 'R717' | 'R290';

interface RefProps {
  name: string;
  tCritC: number;
  // Antoine-like ln(P_kPa) = A - B / (T_K + C)
  antA: number;
  antB: number;
  antC: number;
  hf0: number; // kJ/kg at 0°C
  cpLiq: number;
  hfg0: number; // kJ/kg at 0°C
  cpVap: number;
  gamma: number;
}

const REFRIGERANTS: Record<RefrigerantId, RefProps> = {
  R134a: {
    name: 'R-134a (HFC)',
    tCritC: 101.1,
    antA: 14.41,
    antB: 2094,
    antC: -33.0,
    hf0: 200.0,
    cpLiq: 1.38,
    hfg0: 198.6,
    cpVap: 0.92,
    gamma: 1.12,
  },
  R410A: {
    name: 'R-410A (HFC Blend)',
    tCritC: 71.3,
    antA: 14.55,
    antB: 1745,
    antC: -27.0,
    hf0: 200.0,
    cpLiq: 1.54,
    hfg0: 221.3,
    cpVap: 1.05,
    gamma: 1.17,
  },
  R32: {
    name: 'R-32 (Low-GWP HFC)',
    tCritC: 78.1,
    antA: 14.72,
    antB: 1805,
    antC: -26.0,
    hf0: 200.0,
    cpLiq: 1.72,
    hfg0: 315.2,
    cpVap: 1.18,
    gamma: 1.21,
  },
  R717: {
    name: 'R-717 (Ammonia)',
    tCritC: 132.4,
    antA: 15.16,
    antB: 2132,
    antC: -33.0,
    hf0: 181.2,
    cpLiq: 4.62,
    hfg0: 1262.0,
    cpVap: 2.35,
    gamma: 1.29,
  },
  R290: {
    name: 'R-290 (Propane)',
    tCritC: 96.7,
    antA: 13.78,
    antB: 1872,
    antC: -25.0,
    hf0: 200.0,
    cpLiq: 2.48,
    hfg0: 374.8,
    cpVap: 1.67,
    gamma: 1.14,
  },
};

export interface PhPoint {
  h: number;
  pKpa: number;
  label?: string;
}

export interface PhResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  cyclePoints: PhPoint[];
  dome: {
    liquidLine: PhPoint[];
    vaporLine: PhPoint[];
    pMin: number;
    pMax: number;
    hMin: number;
    hMax: number;
  };
}

function refSatPressureKpa(ref: RefProps, tempC: number): number {
  const tK = tempC + 273.15;
  return Math.exp(ref.antA - ref.antB / (tK + ref.antC));
}

function refHf(ref: RefProps, tempC: number): number {
  return ref.hf0 + ref.cpLiq * tempC;
}

function refHfg(ref: RefProps, tempC: number): number {
  const tau = Math.max(0.02, (ref.tCritC - tempC) / ref.tCritC);
  return ref.hfg0 * Math.pow(tau, 0.38);
}

export function calculatePhRefrigeration(raw: Record<string, number | string>): PhResult {
  const refId = ((raw.refrigerant as RefrigerantId) || 'R134a') in REFRIGERANTS
    ? (raw.refrigerant as RefrigerantId)
    : 'R134a';
  const ref = REFRIGERANTS[refId];

  const tEvapC = Number(raw.tEvapC);
  const tCondC = Number(raw.tCondC);
  const superheatC = Number(raw.superheatC);
  const subcoolC = Number(raw.subcoolC);
  const etaCompPct = Number(raw.etaCompPct);
  const massFlowKgS = Number(raw.massFlowKgS);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(tEvapC) || tEvapC < -50 || tEvapC > 30) {
    issues.push({
      field: 'tEvapC',
      message: 'Evaporator temperature must be between -50 °C and 30 °C.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(tCondC) || tCondC <= tEvapC || tCondC >= ref.tCritC - 4) {
    issues.push({
      field: 'tCondC',
      message: `Condenser temperature must exceed T_evap and remain below ${refId} subcritical limit (${(ref.tCritC - 4).toFixed(1)} °C).`,
      severity: 'error',
    });
  }
  if (!Number.isFinite(superheatC) || superheatC < 0 || superheatC > 35) {
    issues.push({
      field: 'superheatC',
      message: 'Suction superheat must be between 0 K and 35 K.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(subcoolC) || subcoolC < 0 || subcoolC > 25) {
    issues.push({
      field: 'subcoolC',
      message: 'Liquid subcooling must be between 0 K and 25 K.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(etaCompPct) || etaCompPct < 35 || etaCompPct > 100) {
    issues.push({
      field: 'etaCompPct',
      message: 'Compressor isentropic efficiency must be between 35% and 100%.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(massFlowKgS) || massFlowKgS <= 0 || massFlowKgS > 50) {
    issues.push({
      field: 'massFlowKgS',
      message: 'Mass flow rate must be > 0 and ≤ 50 kg/s.',
      severity: 'error',
    });
  }

  // Build saturation dome
  const liquidLine: PhPoint[] = [];
  const vaporLine: PhPoint[] = [];
  const tStart = -55;
  const tEnd = ref.tCritC - 1.5;
  for (let t = tStart; t <= tEnd; t += 3) {
    const pKpa = refSatPressureKpa(ref, t);
    const hf = refHf(ref, t);
    const hg = hf + refHfg(ref, t);
    liquidLine.push({h: hf, pKpa});
    vaporLine.push({h: hg, pKpa});
  }
  const pMin = liquidLine[0].pKpa * 0.7;
  const pMax = refSatPressureKpa(ref, ref.tCritC) * 1.15;
  const allH = [...liquidLine.map((p) => p.h), ...vaporLine.map((p) => p.h)];
  const hMin = Math.min(...allH) - 40;
  const hMax = Math.max(...allH) + 120;

  if (issues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      issues,
      outputs: [],
      cyclePoints: [],
      dome: {liquidLine, vaporLine, pMin, pMax, hMin, hMax},
    };
  }

  const pEvap = refSatPressureKpa(ref, tEvapC);
  const pCond = refSatPressureKpa(ref, tCondC);
  const pressureRatio = pCond / pEvap;

  // State 1: Evaporator outlet + superheat
  const hgEvap = refHf(ref, tEvapC) + refHfg(ref, tEvapC);
  const h1 = hgEvap + ref.cpVap * superheatC;
  const t1K = tEvapC + superheatC + 273.15;

  // State 2s & 2: Compression
  const t2sK = t1K * Math.pow(pressureRatio, (ref.gamma - 1) / ref.gamma);
  const t2sC = t2sK - 273.15;
  const hgCond = refHf(ref, tCondC) + refHfg(ref, tCondC);
  const h2s = Math.max(h1 + 5, hgCond + ref.cpVap * (t2sC - tCondC));
  const wIsen = h2s - h1;
  const wActual = wIsen / (etaCompPct / 100);
  const h2 = h1 + wActual;

  // State 3: Condenser outlet - subcooling
  const h3 = refHf(ref, tCondC) - ref.cpLiq * subcoolC;

  // State 4: Expansion valve (isenthalpic)
  const h4 = h3;
  const x4 = Math.max(0, Math.min(1, (h4 - refHf(ref, tEvapC)) / refHfg(ref, tEvapC)));

  const qEvap = h1 - h4;
  const coolingKw = massFlowKgS * qEvap;
  const compPowerKw = massFlowKgS * wActual;
  const cop = qEvap / wActual;
  const copCarnot = (tEvapC + 273.15) / (tCondC - tEvapC);
  const etaSecondLaw = (cop / copCarnot) * 100;

  if (pressureRatio > 12) {
    issues.push({
      field: 'tCondC',
      message: `High pressure ratio (${pressureRatio.toFixed(1)}:1); two-stage compression with intercooling is recommended in practice.`,
      severity: 'warning',
    });
  }

  const cyclePoints: PhPoint[] = [
    {h: h1, pKpa: pEvap, label: '1 (Comp. Suction)'},
    {h: h2, pKpa: pCond, label: '2 (Discharge)'},
    {h: h3, pKpa: pCond, label: '3 (Cond. Exit)'},
    {h: h4, pKpa: pEvap, label: '4 (Evap. Inlet)'},
  ];

  const outputs: OutputMetric[] = [
    {
      id: 'coolingKw',
      label: 'Cooling Capacity',
      symbol: 'Q̇_L',
      value: coolingKw,
      formatted: coolingKw.toFixed(2),
      unit: 'kW',
      finePrint: `Refrigerating effect Q̇_L = ṁ·(h₁ − h₄) using ${ref.name}, with specific cooling ${qEvap.toFixed(1)} kJ/kg.`,
    },
    {
      id: 'compKw',
      label: 'Compressor Work Input',
      symbol: 'Ẇ_c',
      value: compPowerKw,
      formatted: compPowerKw.toFixed(2),
      unit: 'kW',
      finePrint: `Shaft power input Ẇ_c = ṁ·(h₂ − h₁) at η_c = ${etaCompPct}% (${wActual.toFixed(1)} kJ/kg).`,
    },
    {
      id: 'cop',
      label: 'Coefficient of Performance',
      symbol: 'COP_R',
      value: cop,
      formatted: cop.toFixed(2),
      unit: '–',
      status: cop < 1.5 ? 'warning' : 'nominal',
      statusLabel: cop < 1.5 ? 'Low COP' : 'Nominal',
      finePrint: `Actual COP_R = Q̇_L / Ẇ_c compared against Carnot ceiling COP_max = ${copCarnot.toFixed(2)} (Second-Law η_II = ${etaSecondLaw.toFixed(1)}%).`,
    },
    {
      id: 'pressures',
      label: 'Evap / Cond Pressures',
      symbol: 'P_L / P_H',
      value: `${pEvap.toFixed(0)} / ${pCond.toFixed(0)}`,
      formatted: `${pEvap.toFixed(0)} / ${pCond.toFixed(0)}`,
      unit: 'kPa',
      finePrint: `Saturation pressures yielding compression ratio P_cond / P_evap = ${pressureRatio.toFixed(2)} and flash quality x₄ = ${(x4 * 100).toFixed(1)}%.`,
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    cyclePoints,
    dome: {liquidLine, vaporLine, pMin, pMax, hMin, hMax},
  };
}

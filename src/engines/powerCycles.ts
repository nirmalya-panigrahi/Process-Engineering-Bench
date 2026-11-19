import type {OutputMetric, ValidationIssue} from '../types/bench';

export type CycleType = 'otto' | 'diesel' | 'brayton' | 'rankine';

export interface CycleState {
  id: string;
  tK: number;
  pKpa: number;
  vM3Kg: number;
  sKjKgK: number;
}

export interface CycleCurvePoint {
  tK: number;
  pKpa: number;
  vM3Kg: number;
  sKjKgK: number;
}

export interface PowerCycleResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  cycleType: CycleType;
  states: CycleState[];
  loopPoints: CycleCurvePoint[];
}

export function calculatePowerCycle(raw: Record<string, number | string>): PowerCycleResult {
  const cycleType = ((raw.cycleType as CycleType) || 'otto');
  const ratio = Number(raw.compressionRatio);
  const t1K = Number(raw.t1K);
  const t3K = Number(raw.t3K);
  const p1Kpa = Number(raw.p1Kpa);
  const gamma = Number(raw.gamma);

  const issues: ValidationIssue[] = [];
  const R = 0.287; // kJ/(kg·K) for air-standard cycles

  if (!Number.isFinite(ratio) || ratio < 2 || ratio > 40) {
    issues.push({
      field: 'compressionRatio',
      message: 'Compression / pressure ratio must be between 2 and 40.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(t1K) || t1K < 220 || t1K > 450) {
    issues.push({
      field: 't1K',
      message: 'Inlet temperature T₁ must be between 220 K and 450 K.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(t3K) || t3K < 600 || t3K > 3000) {
    issues.push({
      field: 't3K',
      message: 'Peak temperature T₃ must be between 600 K and 3000 K.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(p1Kpa) || p1Kpa < 20 || p1Kpa > 500) {
    issues.push({
      field: 'p1Kpa',
      message: 'Inlet pressure P₁ must be between 20 kPa and 500 kPa.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(gamma) || gamma < 1.15 || gamma > 1.67) {
    issues.push({
      field: 'gamma',
      message: 'Specific heat ratio γ must be between 1.15 and 1.67.',
      severity: 'error',
    });
  }

  if (issues.some((i) => i.severity === 'error')) {
    return {valid: false, issues, outputs: [], cycleType, states: [], loopPoints: []};
  }

  const cv = R / (gamma - 1);
  const cp = (gamma * R) / (gamma - 1);
  const v1 = (R * t1K) / p1Kpa;
  const s1 = 1.0; // reference baseline kJ/kg·K

  let states: CycleState[] = [];
  const loopPoints: CycleCurvePoint[] = [];
  let qIn = 0;
  let qOut = 0;
  let wNet = 0;
  let etaTh = 0;
  let extraMetric = {label: 'Mean Effective Pressure', symbol: 'MEP', value: 0, unit: 'kPa', finePrint: ''};

  const pushInterp = (n: number, fn: (u: number) => CycleCurvePoint) => {
    for (let i = 0; i < n; i++) {
      loopPoints.push(fn(i / n));
    }
  };

  if (cycleType === 'otto') {
    const t2 = t1K * Math.pow(ratio, gamma - 1);
    if (t3K <= t2 + 50) {
      issues.push({
        field: 't3K',
        message: `Peak temperature T₃ (${t3K} K) must exceed compression temperature T₂ (${t2.toFixed(0)} K) by at least 50 K.`,
        severity: 'error',
      });
      return {valid: false, issues, outputs: [], cycleType, states: [], loopPoints: []};
    }
    const p2 = p1Kpa * Math.pow(ratio, gamma);
    const v2 = v1 / ratio;
    const s2 = s1;

    const v3 = v2;
    const p3 = p2 * (t3K / t2);
    const s3 = s2 + cv * Math.log(t3K / t2);

    const v4 = v1;
    const t4 = t3K / Math.pow(ratio, gamma - 1);
    const p4 = p3 / Math.pow(ratio, gamma);
    const s4 = s3;

    qIn = cv * (t3K - t2);
    qOut = cv * (t4 - t1K);
    wNet = qIn - qOut;
    etaTh = (wNet / qIn) * 100;
    const mep = wNet / (v1 - v2);
    extraMetric = {
      label: 'Mean Effective Pressure',
      symbol: 'MEP',
      value: mep,
      unit: 'kPa',
      finePrint: 'Theoretical constant pressure acting over displacement volume (v₁ − v₂) producing net cycle work w_net.',
    };

    states = [
      {id: '1', tK: t1K, pKpa: p1Kpa, vM3Kg: v1, sKjKgK: s1},
      {id: '2', tK: t2, pKpa: p2, vM3Kg: v2, sKjKgK: s2},
      {id: '3', tK: t3K, pKpa: p3, vM3Kg: v3, sKjKgK: s3},
      {id: '4', tK: t4, pKpa: p4, vM3Kg: v4, sKjKgK: s4},
    ];

    pushInterp(18, (u) => {
      const v = v1 + u * (v2 - v1);
      const p = p1Kpa * Math.pow(v1 / v, gamma);
      return {tK: (p * v) / R, pKpa: p, vM3Kg: v, sKjKgK: s1};
    });
    pushInterp(18, (u) => {
      const t = t2 + u * (t3K - t2);
      return {tK: t, pKpa: p2 * (t / t2), vM3Kg: v2, sKjKgK: s2 + cv * Math.log(t / t2)};
    });
    pushInterp(18, (u) => {
      const v = v3 + u * (v4 - v3);
      const p = p3 * Math.pow(v3 / v, gamma);
      return {tK: (p * v) / R, pKpa: p, vM3Kg: v, sKjKgK: s3};
    });
    pushInterp(18, (u) => {
      const t = t4 + u * (t1K - t4);
      return {tK: t, pKpa: p4 * (t / t4), vM3Kg: v1, sKjKgK: s4 + cv * Math.log(t / t4)};
    });
  } else if (cycleType === 'diesel') {
    const t2 = t1K * Math.pow(ratio, gamma - 1);
    if (t3K <= t2 + 50) {
      issues.push({
        field: 't3K',
        message: `Peak temperature T₃ (${t3K} K) must exceed compression temperature T₂ (${t2.toFixed(0)} K) for positive fuel cutoff.`,
        severity: 'error',
      });
      return {valid: false, issues, outputs: [], cycleType, states: [], loopPoints: []};
    }
    const p2 = p1Kpa * Math.pow(ratio, gamma);
    const v2 = v1 / ratio;
    const s2 = s1;

    const rc = t3K / t2; // cutoff ratio
    if (rc >= ratio) {
      issues.push({
        field: 't3K',
        message: `Cutoff ratio (r_c = ${rc.toFixed(2)}) exceeds compression ratio (${ratio}); reduce T₃ or increase r.`,
        severity: 'error',
      });
      return {valid: false, issues, outputs: [], cycleType, states: [], loopPoints: []};
    }

    const p3 = p2;
    const v3 = v2 * rc;
    const s3 = s2 + cp * Math.log(t3K / t2);

    const v4 = v1;
    const t4 = t3K * Math.pow(v3 / v4, gamma - 1);
    const p4 = p3 * Math.pow(v3 / v4, gamma);
    const s4 = s3;

    qIn = cp * (t3K - t2);
    qOut = cv * (t4 - t1K);
    wNet = qIn - qOut;
    etaTh = (wNet / qIn) * 100;
    const mep = wNet / (v1 - v2);
    extraMetric = {
      label: 'Mean Effective Pressure',
      symbol: 'MEP',
      value: mep,
      unit: 'kPa',
      finePrint: `Cutoff ratio r_c = V₃/V₂ = ${rc.toFixed(2)}; Diesel efficiency drops as r_c rises at fixed compression ratio.`,
    };

    states = [
      {id: '1', tK: t1K, pKpa: p1Kpa, vM3Kg: v1, sKjKgK: s1},
      {id: '2', tK: t2, pKpa: p2, vM3Kg: v2, sKjKgK: s2},
      {id: '3', tK: t3K, pKpa: p3, vM3Kg: v3, sKjKgK: s3},
      {id: '4', tK: t4, pKpa: p4, vM3Kg: v4, sKjKgK: s4},
    ];

    pushInterp(18, (u) => {
      const v = v1 + u * (v2 - v1);
      const p = p1Kpa * Math.pow(v1 / v, gamma);
      return {tK: (p * v) / R, pKpa: p, vM3Kg: v, sKjKgK: s1};
    });
    pushInterp(18, (u) => {
      const v = v2 + u * (v3 - v2);
      const t = t2 * (v / v2);
      return {tK: t, pKpa: p2, vM3Kg: v, sKjKgK: s2 + cp * Math.log(t / t2)};
    });
    pushInterp(18, (u) => {
      const v = v3 + u * (v4 - v3);
      const p = p3 * Math.pow(v3 / v, gamma);
      return {tK: (p * v) / R, pKpa: p, vM3Kg: v, sKjKgK: s3};
    });
    pushInterp(18, (u) => {
      const t = t4 + u * (t1K - t4);
      return {tK: t, pKpa: p4 * (t / t4), vM3Kg: v1, sKjKgK: s4 + cv * Math.log(t / t4)};
    });
  } else if (cycleType === 'brayton') {
    const rp = ratio;
    const t2 = t1K * Math.pow(rp, (gamma - 1) / gamma);
    if (t3K <= t2 + 50) {
      issues.push({
        field: 't3K',
        message: `Turbine inlet T₃ (${t3K} K) must exceed compressor exit T₂ (${t2.toFixed(0)} K).`,
        severity: 'error',
      });
      return {valid: false, issues, outputs: [], cycleType, states: [], loopPoints: []};
    }
    const p2 = p1Kpa * rp;
    const v2 = (R * t2) / p2;
    const s2 = s1;

    const p3 = p2;
    const v3 = (R * t3K) / p3;
    const s3 = s2 + cp * Math.log(t3K / t2);

    const p4 = p1Kpa;
    const t4 = t3K / Math.pow(rp, (gamma - 1) / gamma);
    const v4 = (R * t4) / p4;
    const s4 = s3;

    qIn = cp * (t3K - t2);
    qOut = cp * (t4 - t1K);
    wNet = qIn - qOut;
    etaTh = (wNet / qIn) * 100;
    const wComp = cp * (t2 - t1K);
    const wTurb = cp * (t3K - t4);
    const bwr = (wComp / wTurb) * 100;
    extraMetric = {
      label: 'Back-Work Ratio',
      symbol: 'BWR',
      value: bwr,
      unit: '%',
      finePrint: 'Fraction of turbine shaft work consumed by the compressor (w_comp / w_turb); gas turbines typically operate at 40–65%.',
    };

    states = [
      {id: '1', tK: t1K, pKpa: p1Kpa, vM3Kg: v1, sKjKgK: s1},
      {id: '2', tK: t2, pKpa: p2, vM3Kg: v2, sKjKgK: s2},
      {id: '3', tK: t3K, pKpa: p3, vM3Kg: v3, sKjKgK: s3},
      {id: '4', tK: t4, pKpa: p4, vM3Kg: v4, sKjKgK: s4},
    ];

    pushInterp(18, (u) => {
      const p = p1Kpa * Math.pow(rp, u);
      const t = t1K * Math.pow(p / p1Kpa, (gamma - 1) / gamma);
      return {tK: t, pKpa: p, vM3Kg: (R * t) / p, sKjKgK: s1};
    });
    pushInterp(18, (u) => {
      const t = t2 + u * (t3K - t2);
      return {tK: t, pKpa: p2, vM3Kg: (R * t) / p2, sKjKgK: s2 + cp * Math.log(t / t2)};
    });
    pushInterp(18, (u) => {
      const p = p3 * Math.pow(1 / rp, u);
      const t = t3K * Math.pow(p / p3, (gamma - 1) / gamma);
      return {tK: t, pKpa: p, vM3Kg: (R * t) / p, sKjKgK: s3};
    });
    pushInterp(18, (u) => {
      const t = t4 + u * (t1K - t4);
      return {tK: t, pKpa: p1Kpa, vM3Kg: (R * t) / p1Kpa, sKjKgK: s4 + cp * Math.log(t / t4)};
    });
  } else {
    // Ideal Rankine representation (using pressure ratio P_boiler / P_cond)
    const pCond = Math.min(p1Kpa, 25); // kPa
    const pBoiler = pCond * ratio * 10; // scale ratio into realistic MPa boiler pressure
    const tSatCondK = 273.15 + 45 + 15 * Math.log(pCond / 10);
    const tSatBoilerK = Math.min(t3K - 20, 273.15 + 100 + 38 * Math.log(pBoiler / 101.3));
    const vLiq = 0.00101;
    const wPump = vLiq * (pBoiler - pCond);
    const t2 = tSatCondK + 0.5;
    const sCondF = 0.65;
    const sCondG = 8.15 - 0.15 * Math.log(pCond / 10);
    const sBoilerF = sCondF + 4.18 * Math.log(tSatBoilerK / tSatCondK);
    const sBoilerG = sBoilerF + 2100 / tSatBoilerK;
    const s3 = sBoilerG + 2.1 * Math.log(Math.max(t3K, tSatBoilerK + 10) / tSatBoilerK);

    const hBoiler = 4.18 * (tSatBoilerK - 273.15) + 2100 + 2.1 * Math.max(0, t3K - tSatBoilerK);
    const hCondF = 4.18 * (tSatCondK - 273.15);
    const x4 = Math.min(0.99, Math.max(0.75, (s3 - sCondF) / (sCondG - sCondF)));
    const h4 = hCondF + x4 * 2380;
    const wTurb = hBoiler - h4;
    qIn = hBoiler - (hCondF + wPump);
    qOut = h4 - hCondF;
    wNet = wTurb - wPump;
    etaTh = (wNet / qIn) * 100;
    const bwr = (wPump / wTurb) * 100;
    const v3 = (0.4615 * t3K) / pBoiler;
    const v4 = x4 * ((0.4615 * tSatCondK) / pCond);

    extraMetric = {
      label: 'Back-Work Ratio',
      symbol: 'BWR',
      value: bwr,
      unit: '%',
      finePrint: `Liquid feedwater pumping requires negligible work (${wPump.toFixed(2)} kJ/kg vs ${wTurb.toFixed(0)} kJ/kg turbine output).`,
    };

    states = [
      {id: '1', tK: tSatCondK, pKpa: pCond, vM3Kg: vLiq, sKjKgK: sCondF},
      {id: '2', tK: t2, pKpa: pBoiler, vM3Kg: vLiq, sKjKgK: sCondF},
      {id: '3', tK: t3K, pKpa: pBoiler, vM3Kg: v3, sKjKgK: s3},
      {id: '4', tK: tSatCondK, pKpa: pCond, vM3Kg: v4, sKjKgK: s3},
    ];

    pushInterp(6, (u) => ({
      tK: tSatCondK + u * 0.5,
      pKpa: pCond + u * (pBoiler - pCond),
      vM3Kg: vLiq,
      sKjKgK: sCondF,
    }));
    pushInterp(16, (u) => ({
      tK: t2 + u * (tSatBoilerK - t2),
      pKpa: pBoiler,
      vM3Kg: vLiq * (1 + 2 * u),
      sKjKgK: sCondF + u * (sBoilerF - sCondF),
    }));
    pushInterp(14, (u) => ({
      tK: tSatBoilerK,
      pKpa: pBoiler,
      vM3Kg: vLiq * 3 + u * (v3 * 0.7 - vLiq * 3),
      sKjKgK: sBoilerF + u * (sBoilerG - sBoilerF),
    }));
    pushInterp(14, (u) => ({
      tK: tSatBoilerK + u * (t3K - tSatBoilerK),
      pKpa: pBoiler,
      vM3Kg: v3 * (0.7 + 0.3 * u),
      sKjKgK: sBoilerG + u * (s3 - sBoilerG),
    }));
    pushInterp(18, (u) => ({
      tK: t3K - u * (t3K - tSatCondK),
      pKpa: pBoiler * Math.pow(pCond / pBoiler, u),
      vM3Kg: v3 + u * (v4 - v3),
      sKjKgK: s3,
    }));
    pushInterp(18, (u) => ({
      tK: tSatCondK,
      pKpa: pCond,
      vM3Kg: v4 + u * (vLiq - v4),
      sKjKgK: s3 - u * (s3 - sCondF),
    }));
  }

  const carnotLimit = (1 - t1K / t3K) * 100;

  const outputs: OutputMetric[] = [
    {
      id: 'wNet',
      label: 'Net Work Output',
      symbol: 'w_net',
      value: wNet,
      formatted: wNet.toFixed(1),
      unit: 'kJ/kg',
      finePrint: 'Enclosed area on both the P–v and T–s cycle diagrams: w_net = q_in − q_out.',
    },
    {
      id: 'qInOut',
      label: 'Heat Added / Rejected',
      symbol: 'q_in / q_out',
      value: `${qIn.toFixed(0)} / ${qOut.toFixed(0)}`,
      formatted: `${qIn.toFixed(0)} / ${qOut.toFixed(0)}`,
      unit: 'kJ/kg',
      finePrint: 'Specific thermal energy added from high-temperature reservoir (2→3) and rejected to sink (4→1).',
    },
    {
      id: 'etaTh',
      label: 'Thermal Efficiency',
      symbol: 'η_th',
      value: etaTh,
      formatted: etaTh.toFixed(2),
      unit: '%',
      status: 'nominal',
      statusLabel: `Carnot ${carnotLimit.toFixed(1)}%`,
      finePrint: `First-law cycle efficiency η_th = w_net / q_in, bounded above by Carnot limit (1 − T_min/T_max) = ${carnotLimit.toFixed(1)}%.`,
    },
    {
      id: 'extra',
      label: extraMetric.label,
      symbol: extraMetric.symbol,
      value: extraMetric.value,
      formatted: extraMetric.value.toFixed(1),
      unit: extraMetric.unit,
      finePrint: extraMetric.finePrint,
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    cycleType,
    states,
    loopPoints,
  };
}

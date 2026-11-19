import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface PumpCurvePoint {
  qM3h: number;
  hPumpM: number;
  hSysM: number;
  etaPct: number;
  npshReqM: number;
}

export interface PumpHeadResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  operatingPoint: {
    qOpM3h: number;
    hOpM: number;
    etaOpPct: number;
    powerKw: number;
    npshMarginM: number;
  } | null;
  curves: PumpCurvePoint[];
}

export function calculatePumpHead(raw: Record<string, number | string>): PumpHeadResult {
  const speedRatio = Number(raw.speedRatio);
  const impellerRatio = Number(raw.impellerRatio);
  const shutoffHeadM = Number(raw.shutoffHeadM);
  const ratedFlowM3h = Number(raw.ratedFlowM3h);
  const staticHeadM = Number(raw.staticHeadM);
  const frictionCoeff = Number(raw.frictionCoeff);
  const npshAvailM = Number(raw.npshAvailM);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(speedRatio) || speedRatio < 0.4 || speedRatio > 1.5) {
    issues.push({
      field: 'speedRatio',
      message: 'Speed ratio N/N₀ must be between 0.40 and 1.50.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(impellerRatio) || impellerRatio < 0.7 || impellerRatio > 1.15) {
    issues.push({
      field: 'impellerRatio',
      message: 'Impeller diameter trim D/D₀ must be between 0.70 and 1.15.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(shutoffHeadM) || shutoffHeadM <= 5 || shutoffHeadM > 300) {
    issues.push({
      field: 'shutoffHeadM',
      message: 'Rated shutoff head H₀ must be > 5 m and ≤ 300 m.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(ratedFlowM3h) || ratedFlowM3h <= 5 || ratedFlowM3h > 2000) {
    issues.push({
      field: 'ratedFlowM3h',
      message: 'Rated BEP flow Q_BEP must be > 5 m³/h and ≤ 2,000 m³/h.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(staticHeadM) || staticHeadM < 0 || staticHeadM > 250) {
    issues.push({
      field: 'staticHeadM',
      message: 'Static elevation head H_stat must be between 0 m and 250 m.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(frictionCoeff) || frictionCoeff < 0.0001 || frictionCoeff > 0.5) {
    issues.push({
      field: 'frictionCoeff',
      message: 'System resistance k_sys must be between 0.0001 and 0.5 m/(m³/h)².',
      severity: 'error',
    });
  }
  if (!Number.isFinite(npshAvailM) || npshAvailM < 0.5 || npshAvailM > 30) {
    issues.push({
      field: 'npshAvailM',
      message: 'Available NPSH must be between 0.5 m and 30 m.',
      severity: 'error',
    });
  }

  if (issues.some((i) => i.severity === 'error')) {
    return {valid: false, issues, outputs: [], operatingPoint: null, curves: []};
  }

  // Affinity laws scaling
  const alphaN = speedRatio;
  const alphaD = impellerRatio;
  const qScale = alphaN * alphaD;
  const hScale = alphaN * alphaN * alphaD * alphaD;

  const h0Scaled = shutoffHeadM * hScale;
  const qBepScaled = ratedFlowM3h * qScale;
  const qMaxPump = qBepScaled * 1.48;
  // Parabolic pump curve: H(Q) = h0Scaled * (1 - 0.28 * (Q/qBepScaled)^2 - 0.12 * (Q/qBepScaled)) or quadratic:
  // Clean quadratic H(Q) = h0Scaled - cPump * Q^2 where at Q = qBepScaled, H = 0.72 * h0Scaled
  const cPump = (0.28 * h0Scaled) / (qBepScaled * qBepScaled);

  const etaPeak = 82 * (1 - 0.15 * Math.abs(1 - alphaD));
  const evalEfficiency = (q: number) => {
    const u = q / qBepScaled;
    return Math.max(0, etaPeak * (2 * u - u * u));
  };
  const evalNpshReq = (q: number) => {
    const u = q / qBepScaled;
    return (1.2 + 2.4 * u * u) * alphaN * alphaN;
  };

  const qMaxPlot = Math.max(qMaxPump * 1.1, ratedFlowM3h * 1.55);
  const curves: PumpCurvePoint[] = [];
  for (let i = 0; i <= 40; i++) {
    const q = (i / 40) * qMaxPlot;
    const hPump = Math.max(0, h0Scaled - cPump * q * q);
    const hSys = staticHeadM + frictionCoeff * q * q;
    curves.push({
      qM3h: q,
      hPumpM: hPump,
      hSysM: hSys,
      etaPct: evalEfficiency(q),
      npshReqM: evalNpshReq(q),
    });
  }

  if (h0Scaled <= staticHeadM) {
    issues.push({
      field: 'staticHeadM',
      message: `Pump shutoff head (${h0Scaled.toFixed(1)} m) is at or below static elevation head (${staticHeadM.toFixed(1)} m); zero forward flow (dead-head condition).`,
      severity: 'error',
    });
    return {valid: false, issues, outputs: [], operatingPoint: null, curves};
  }

  const qOpM3h = Math.sqrt((h0Scaled - staticHeadM) / (cPump + frictionCoeff));
  const hOpM = staticHeadM + frictionCoeff * qOpM3h * qOpM3h;
  const etaOpPct = Math.max(5, evalEfficiency(qOpM3h));
  const npshReqOp = evalNpshReq(qOpM3h);
  const npshMarginM = npshAvailM - npshReqOp;

  // Water density 998 kg/m3, g = 9.81 m/s2
  const qM3s = qOpM3h / 3600;
  const pHydKw = (998 * 9.81 * qM3s * hOpM) / 1000;
  const powerKw = pHydKw / (etaOpPct / 100);

  let npshStatus: 'nominal' | 'warning' | 'critical' = 'nominal';
  let npshStatusLabel = 'Cavitation Safe';
  if (npshMarginM < 0) {
    npshStatus = 'critical';
    npshStatusLabel = 'Cavitation Risk';
    issues.push({
      field: 'npshAvailM',
      message: `NPSHa (${npshAvailM.toFixed(1)} m) is below NPSHr (${npshReqOp.toFixed(1)} m); active cavitation will damage impeller.`,
      severity: 'warning',
    });
  } else if (npshMarginM < 1.0) {
    npshStatus = 'warning';
    npshStatusLabel = 'Low Margin';
    issues.push({
      field: 'npshAvailM',
      message: `NPSH margin (${npshMarginM.toFixed(2)} m) is below recommended 1.0 m safety allowance.`,
      severity: 'warning',
    });
  }

  const bepRatio = (qOpM3h / qBepScaled) * 100;

  const outputs: OutputMetric[] = [
    {
      id: 'qOp',
      label: 'System Operating Flow Rate',
      symbol: 'Q_op',
      value: qOpM3h,
      formatted: qOpM3h.toFixed(1),
      unit: 'm³/h',
      finePrint: `Intersection of scaled pump curve and H_sys = H_stat + k·Q² (${bepRatio.toFixed(0)}% of scaled BEP flow ${qBepScaled.toFixed(1)} m³/h).`,
    },
    {
      id: 'hOp',
      label: 'Operating Head',
      symbol: 'H_op',
      value: hOpM,
      formatted: hOpM.toFixed(2),
      unit: 'm',
      finePrint: `Total dynamic head delivered against ${staticHeadM.toFixed(1)} m static lift plus ${(hOpM - staticHeadM).toFixed(2)} m piping friction loss.`,
    },
    {
      id: 'etaOp',
      label: 'Pump Efficiency & Shaft Power',
      symbol: 'η / P_sh',
      value: etaOpPct,
      formatted: `${etaOpPct.toFixed(1)}% · ${powerKw.toFixed(2)} kW`,
      unit: '',
      status: bepRatio < 70 || bepRatio > 120 ? 'warning' : 'nominal',
      statusLabel: bepRatio < 70 || bepRatio > 120 ? 'Off-BEP' : 'Near BEP',
      finePrint: `Hydraulic power ${pHydKw.toFixed(2)} kW divided by pump efficiency η(Q_op). Preferred operating region is 70–120% of BEP.`,
    },
    {
      id: 'npshMargin',
      label: 'NPSH Margin',
      symbol: 'NPSHa−r',
      value: npshMarginM,
      formatted: `${npshMarginM >= 0 ? '+' : ''}${npshMarginM.toFixed(2)}`,
      unit: 'm',
      status: npshStatus,
      statusLabel: npshStatusLabel,
      finePrint: `Available NPSH (${npshAvailM.toFixed(1)} m) minus Required NPSHr (${npshReqOp.toFixed(2)} m). Maintain ≥ 1.0 m margin to avoid cavitation.`,
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    operatingPoint: {
      qOpM3h,
      hOpM,
      etaOpPct,
      powerKw,
      npshMarginM,
    },
    curves,
  };
}

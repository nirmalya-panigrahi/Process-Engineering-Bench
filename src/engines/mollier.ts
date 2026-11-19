import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface MollierPoint {
  s: number;
  h: number;
  label?: string;
}

export interface MollierIsoCurve {
  label: string;
  points: MollierPoint[];
}

export interface MollierResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  states: {
    s1: number;
    h1: number;
    s2s: number;
    h2s: number;
    s2: number;
    h2: number;
    tSat1C: number;
    tSat2C: number;
    t2C: number;
    x2s: number | null;
    x2: number | null;
  } | null;
  dome: {
    liquidLine: MollierPoint[];
    vaporLine: MollierPoint[];
    isobars: MollierIsoCurve[];
    qualityLines: MollierIsoCurve[];
  };
}

/** Saturation temperature (°C) for steam from pressure P (bar), calibrated 0.02..200 bar. */
export function steamSatTempC(pBar: number): number {
  const lnP = Math.log(Math.max(pBar, 0.01));
  return 99.63 + 27.95 * lnP + 2.38 * lnP * lnP + 0.14 * Math.pow(lnP, 3);
}

/** Saturated liquid enthalpy h_f (kJ/kg) as a function of pressure (bar). */
export function steamHf(pBar: number): number {
  const tSat = steamSatTempC(pBar);
  return 4.186 * tSat + 0.00055 * Math.pow(tSat, 2) + 0.0000018 * Math.pow(tSat, 3);
}

/** Latent heat of vaporization h_fg (kJ/kg) calibrated to IAPWS-97 critical point (~220.6 bar, 374°C). */
export function steamHfg(pBar: number): number {
  const tSat = steamSatTempC(pBar);
  const tCrit = 373.95;
  const tau = Math.max(0, 1 - (tSat + 273.15) / (tCrit + 273.15));
  return 2501.3 * Math.pow(tau / 0.4248, 0.375) * (1 - 0.08 * tau);
}

export function steamHg(pBar: number): number {
  return steamHf(pBar) + steamHfg(pBar);
}

export function steamSf(pBar: number): number {
  const tSatK = steamSatTempC(pBar) + 273.15;
  return 4.186 * Math.log(tSatK / 273.15) + 0.0012 * (tSatK - 273.15);
}

export function steamSg(pBar: number): number {
  const tSatK = steamSatTempC(pBar) + 273.15;
  return steamSf(pBar) + steamHfg(pBar) / tSatK;
}

/** Effective superheated steam cp (kJ/kg·K) capturing pressure-dependent enthalpy curvature. */
function superheatCp(pBar: number, tempC: number): number {
  const tSat = steamSatTempC(pBar);
  const sup = Math.max(0, tempC - tSat);
  const pFactor = 0.018 * Math.pow(pBar, 0.55) * Math.exp(-sup / 90);
  return 1.92 + 0.00052 * tempC + pFactor;
}

export function superheatSteamEnthalpyEntropy(pBar: number, tempC: number): {h: number; s: number} {
  const tSat = steamSatTempC(pBar);
  const hg = steamHg(pBar);
  const sg = steamSg(pBar);
  if (tempC <= tSat) {
    return {h: hg, s: sg};
  }
  const steps = 20;
  const dT = (tempC - tSat) / steps;
  let h = hg;
  let s = sg;
  for (let i = 0; i < steps; i++) {
    const tm = tSat + (i + 0.5) * dT;
    const cp = superheatCp(pBar, tm);
    h += cp * dT;
    s += (cp / (tm + 273.15)) * dT;
  }
  return {h, s};
}

function solveSuperheatTempFromEntropy(pBar: number, sTarget: number): number {
  const tSat = steamSatTempC(pBar);
  let lo = tSat;
  let hi = 900;
  for (let i = 0; i < 36; i++) {
    const mid = 0.5 * (lo + hi);
    const {s} = superheatSteamEnthalpyEntropy(pBar, mid);
    if (s < sTarget) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function solveSuperheatTempFromEnthalpy(pBar: number, hTarget: number): number {
  const tSat = steamSatTempC(pBar);
  let lo = tSat;
  let hi = 900;
  for (let i = 0; i < 36; i++) {
    const mid = 0.5 * (lo + hi);
    const {h} = superheatSteamEnthalpyEntropy(pBar, mid);
    if (h < hTarget) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function buildMollierDome() {
  const pGrid = [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40, 80, 120, 160, 200];
  const liquidLine: MollierPoint[] = pGrid.map((p) => ({s: steamSf(p), h: steamHf(p)}));
  const vaporLine: MollierPoint[] = pGrid.map((p) => ({s: steamSg(p), h: steamHg(p)}));

  const isobarPressures = [0.1, 1, 10, 40, 100];
  const isobars: MollierIsoCurve[] = isobarPressures.map((p) => {
    const pts: MollierPoint[] = [];
    const sf = steamSf(p);
    const sg = steamSg(p);
    const hf = steamHf(p);
    const hg = steamHg(p);
    for (let x = 0.6; x <= 1.0; x += 0.1) {
      pts.push({s: sf + x * (sg - sf), h: hf + x * (hg - hf)});
    }
    const tSat = steamSatTempC(p);
    for (let sup = 40; sup <= 360; sup += 40) {
      const {h, s} = superheatSteamEnthalpyEntropy(p, tSat + sup);
      pts.push({s, h});
    }
    return {label: `${p} bar`, points: pts};
  });

  const qualityTargets = [0.8, 0.85, 0.9, 0.95];
  const qualityLines: MollierIsoCurve[] = qualityTargets.map((q) => ({
    label: `x = ${q.toFixed(2)}`,
    points: pGrid
      .filter((p) => p <= 160)
      .map((p) => ({
        s: steamSf(p) + q * (steamSg(p) - steamSf(p)),
        h: steamHf(p) + q * (steamHg(p) - steamHf(p)),
      })),
  }));

  return {liquidLine, vaporLine, isobars, qualityLines};
}

export function calculateMollier(raw: Record<string, number | string>): MollierResult {
  const p1Bar = Number(raw.p1Bar);
  const t1C = Number(raw.t1C);
  const p2Bar = Number(raw.p2Bar);
  const etaPct = Number(raw.etaPct);

  const dome = buildMollierDome();
  const issues: ValidationIssue[] = [];

  if (!Number.isFinite(p1Bar) || p1Bar < 0.5 || p1Bar > 200) {
    issues.push({
      field: 'p1Bar',
      message: 'Inlet steam pressure P₁ must be between 0.5 bar and 200 bar.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(p2Bar) || p2Bar < 0.02 || p2Bar >= p1Bar) {
    issues.push({
      field: 'p2Bar',
      message: 'Exhaust pressure P₂ must be ≥ 0.02 bar and strictly less than inlet pressure P₁.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(t1C) || t1C < 80 || t1C > 650) {
    issues.push({
      field: 't1C',
      message: 'Inlet steam temperature T₁ must be between 80 °C and 650 °C.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(etaPct) || etaPct < 40 || etaPct > 100) {
    issues.push({
      field: 'etaPct',
      message: 'Isentropic turbine efficiency η_s must be between 40% and 100%.',
      severity: 'error',
    });
  }

  if (issues.some((i) => i.severity === 'error')) {
    return {valid: false, issues, outputs: [], states: null, dome};
  }

  const tSat1 = steamSatTempC(p1Bar);
  if (t1C < tSat1 - 0.1) {
    issues.push({
      field: 't1C',
      message: `Inlet temperature (${t1C.toFixed(1)} °C) is below saturation temperature (${tSat1.toFixed(1)} °C at ${p1Bar} bar); inlet steam cannot be subcooled liquid.`,
      severity: 'error',
    });
    return {valid: false, issues, outputs: [], states: null, dome};
  }

  const {h: h1, s: s1} = superheatSteamEnthalpyEntropy(p1Bar, t1C);
  const tSat2 = steamSatTempC(p2Bar);
  const sf2 = steamSf(p2Bar);
  const sg2 = steamSg(p2Bar);
  const hf2 = steamHf(p2Bar);
  const hg2 = steamHg(p2Bar);

  let h2s = 0;
  let x2s: number | null = null;
  if (s1 <= sg2) {
    x2s = Math.max(0, Math.min(1, (s1 - sf2) / (sg2 - sf2)));
    h2s = hf2 + x2s * (hg2 - hf2);
  } else {
    const t2s = solveSuperheatTempFromEntropy(p2Bar, s1);
    h2s = superheatSteamEnthalpyEntropy(p2Bar, t2s).h;
  }

  const eta = etaPct / 100;
  const deltaHs = h1 - h2s;
  const wActual = eta * deltaHs;
  const h2 = h1 - wActual;

  let s2 = 0;
  let x2: number | null = null;
  let t2C = tSat2;
  if (h2 <= hg2) {
    x2 = Math.max(0, Math.min(1, (h2 - hf2) / (hg2 - hf2)));
    s2 = sf2 + x2 * (sg2 - sf2);
    t2C = tSat2;
  } else {
    t2C = solveSuperheatTempFromEnthalpy(p2Bar, h2);
    s2 = superheatSteamEnthalpyEntropy(p2Bar, t2C).s;
  }

  const sGen = s2 - s1;
  const moistureStatus: 'nominal' | 'warning' = x2 !== null && x2 < 0.88 ? 'warning' : 'nominal';
  if (x2 !== null && x2 < 0.88) {
    issues.push({
      field: 'p2Bar',
      message: `Exhaust moisture exceeds 12% (quality x₂ = ${x2.toFixed(3)}); blade erosion risk in low-pressure turbine stages.`,
      severity: 'warning',
    });
  }

  const outputs: OutputMetric[] = [
    {
      id: 'deltaHs',
      label: 'Isentropic Enthalpy Drop',
      symbol: 'Δh_s',
      value: deltaHs,
      formatted: deltaHs.toFixed(1),
      unit: 'kJ/kg',
      finePrint: 'Ideal reversible adiabatic expansion drop h₁ − h₂s along constant entropy s₁ = s₂s.',
    },
    {
      id: 'wActual',
      label: 'Actual Turbine Work',
      symbol: 'w_t',
      value: wActual,
      formatted: wActual.toFixed(1),
      unit: 'kJ/kg',
      finePrint: 'Specific shaft work extracted: w_t = η_s · (h₁ − h₂s) = h₁ − h₂.',
    },
    {
      id: 'x2',
      label: 'Exhaust Steam Quality',
      symbol: 'x₂',
      value: x2 !== null ? x2 : 'Superheated',
      formatted: x2 !== null ? `${(x2 * 100).toFixed(2)}%` : `Superheated (+${(t2C - tSat2).toFixed(1)} °C)`,
      unit: x2 !== null ? 'dryness' : '',
      status: moistureStatus,
      statusLabel: x2 !== null && x2 < 0.88 ? 'High Moisture' : 'Acceptable',
      finePrint:
        'Mass fraction of vapor in the two-phase exhaust mixture. Steam turbines typically limit exhaust quality x₂ ≥ 0.88 to prevent droplet erosion.',
    },
    {
      id: 't2',
      label: 'Exhaust Temperature',
      symbol: 'T₂',
      value: t2C,
      formatted: t2C.toFixed(1),
      unit: '°C',
      finePrint: 'Equals T_sat(P₂) inside the wet vapor dome, or superheated outlet temperature if h₂ > h_g(P₂).',
    },
    {
      id: 'sGen',
      label: 'Entropy Generation',
      symbol: 'Δs_gen',
      value: sGen,
      formatted: sGen.toFixed(4),
      unit: 'kJ/kg·K',
      finePrint: 'Irreversible entropy increase s₂ − s₁ across adiabatic turbine expansion due to aerodynamic & friction losses.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    states: {
      s1,
      h1,
      s2s: s1,
      h2s,
      s2,
      h2,
      tSat1C: tSat1,
      tSat2C: tSat2,
      t2C,
      x2s,
      x2,
    },
    dome,
  };
}

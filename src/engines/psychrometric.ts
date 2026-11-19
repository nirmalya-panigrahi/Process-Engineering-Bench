import type {OutputMetric, ValidationIssue} from '../types/bench';

export type PsychroInputMode = 'db-rh' | 'db-wb' | 'db-dp';

export interface PsychroInputs {
  mode: PsychroInputMode;
  dryBulbC: number;
  relativeHumidityPct: number;
  wetBulbC: number;
  dewPointC: number;
  pressureKpa: number;
}

export interface PsychroPoint {
  tDb: number;
  wGkg: number;
}

export interface PsychroCurve {
  id: string;
  label: string;
  points: PsychroPoint[];
}

export interface PsychroResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  statePoint: {
    tDb: number;
    tWb: number;
    tDp: number;
    rhPct: number;
    wKgKg: number;
    wGkg: number;
    enthalpyKjKg: number;
    specificVolumeM3Kg: number;
    vaporPressureKpa: number;
    satVaporPressureKpa: number;
  } | null;
  curves: {
    saturation: PsychroPoint[];
    rhLines: PsychroCurve[];
    enthalpyLines: PsychroCurve[];
  };
}

/** Saturation vapor pressure in kPa via Arden Buck equation (-40 to +65 °C). */
export function saturationVaporPressureKpa(tempC: number): number {
  if (tempC >= 0) {
    return 0.61121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  }
  return 0.61115 * Math.exp((23.036 - tempC / 333.7) * (tempC / (279.82 + tempC)));
}

export function humidityRatioFromVaporPressure(pvKpa: number, pAtmKpa: number): number {
  const denom = Math.max(pAtmKpa - pvKpa, 0.1);
  return 0.621945 * (pvKpa / denom);
}

export function dewPointFromVaporPressure(pvKpa: number): number {
  const safePv = Math.max(pvKpa, 0.01);
  const lnRatio = Math.log(safePv / 0.61121);
  return (257.14 * lnRatio) / (18.678 - lnRatio);
}

export function moistAirEnthalpyKjKg(tDbC: number, wKgKg: number): number {
  return 1.006 * tDbC + wKgKg * (2501 + 1.86 * tDbC);
}

export function moistAirSpecificVolume(tDbC: number, wKgKg: number, pAtmKpa: number): number {
  return (0.287042 * (tDbC + 273.15) * (1 + 1.607858 * wKgKg)) / pAtmKpa;
}

export function humidityRatioFromWetBulb(tDbC: number, tWbC: number, pAtmKpa: number): number {
  const pwsWb = saturationVaporPressureKpa(tWbC);
  const wsWb = humidityRatioFromVaporPressure(pwsWb, pAtmKpa);
  if (tWbC >= 0) {
    const num = (2501 - 2.326 * tWbC) * wsWb - 1.006 * (tDbC - tWbC);
    const den = 2501 + 1.86 * tDbC - 4.186 * tWbC;
    return Math.max(0, num / den);
  }
  const num = (2830 - 0.24 * tWbC) * wsWb - 1.006 * (tDbC - tWbC);
  const den = 2830 + 1.86 * tDbC - 2.1 * tWbC;
  return Math.max(0, num / den);
}

export function solveWetBulbC(tDbC: number, wTarget: number, pAtmKpa: number): number {
  let lo = -30;
  let hi = tDbC;
  for (let i = 0; i < 45; i++) {
    const mid = 0.5 * (lo + hi);
    const wMid = humidityRatioFromWetBulb(tDbC, mid, pAtmKpa);
    if (wMid < wTarget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}

function buildPsychroCurves(pAtmKpa: number) {
  const temps: number[] = [];
  for (let t = -5; t <= 55; t += 2) {
    temps.push(t);
  }

  const saturation: PsychroPoint[] = temps.map((t) => {
    const pws = saturationVaporPressureKpa(t);
    const w = Math.min(humidityRatioFromVaporPressure(pws, pAtmKpa) * 1000, 45);
    return {tDb: t, wGkg: w};
  });

  const rhLevels = [20, 40, 60, 80];
  const rhLines: PsychroCurve[] = rhLevels.map((rh) => ({
    id: `rh-${rh}`,
    label: `${rh}% RH`,
    points: temps.map((t) => {
      const pv = (rh / 100) * saturationVaporPressureKpa(t);
      const w = Math.min(humidityRatioFromVaporPressure(pv, pAtmKpa) * 1000, 45);
      return {tDb: t, wGkg: w};
    }),
  }));

  const enthalpyTargets = [20, 40, 60, 80, 100, 120];
  const enthalpyLines: PsychroCurve[] = enthalpyTargets.map((hTarget) => {
    const pts: PsychroPoint[] = [];
    for (let t = -5; t <= 55; t += 2.5) {
      const wKg = (hTarget - 1.006 * t) / (2501 + 1.86 * t);
      const wSat = humidityRatioFromVaporPressure(saturationVaporPressureKpa(t), pAtmKpa);
      if (wKg >= 0 && wKg <= wSat + 0.0005 && wKg * 1000 <= 45) {
        pts.push({tDb: t, wGkg: wKg * 1000});
      }
    }
    return {
      id: `h-${hTarget}`,
      label: `${hTarget} kJ/kg`,
      points: pts,
    };
  });

  return {saturation, rhLines, enthalpyLines};
}

export function calculatePsychrometric(raw: Record<string, number | string>): PsychroResult {
  const mode = (raw.mode as PsychroInputMode) || 'db-rh';
  const dryBulbC = Number(raw.dryBulbC);
  const relativeHumidityPct = Number(raw.relativeHumidityPct);
  const wetBulbC = Number(raw.wetBulbC);
  const dewPointC = Number(raw.dewPointC);
  const pressureKpa = Number(raw.pressureKpa);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(dryBulbC) || dryBulbC < -10 || dryBulbC > 55) {
    issues.push({
      field: 'dryBulbC',
      message: 'Dry-bulb temperature must be between -10 °C and 55 °C.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(pressureKpa) || pressureKpa < 50 || pressureKpa > 120) {
    issues.push({
      field: 'pressureKpa',
      message: 'Barometric pressure must be between 50 kPa and 120 kPa.',
      severity: 'error',
    });
  }

  const curves = buildPsychroCurves(Number.isFinite(pressureKpa) && pressureKpa >= 50 ? pressureKpa : 101.325);

  if (mode === 'db-rh') {
    if (!Number.isFinite(relativeHumidityPct) || relativeHumidityPct < 0.1 || relativeHumidityPct > 100) {
      issues.push({
        field: 'relativeHumidityPct',
        message: 'Relative humidity must be between 0.1% and 100%.',
        severity: 'error',
      });
    }
  } else if (mode === 'db-wb') {
    if (!Number.isFinite(wetBulbC) || wetBulbC < -20 || wetBulbC > dryBulbC) {
      issues.push({
        field: 'wetBulbC',
        message: 'Wet-bulb temperature must be ≥ -20 °C and cannot exceed dry-bulb temperature.',
        severity: 'error',
      });
    }
  } else if (mode === 'db-dp') {
    if (!Number.isFinite(dewPointC) || dewPointC < -30 || dewPointC > dryBulbC) {
      issues.push({
        field: 'dewPointC',
        message: 'Dew point must be ≥ -30 °C and cannot exceed dry-bulb temperature.',
        severity: 'error',
      });
    }
  }

  if (issues.some((i) => i.severity === 'error')) {
    return {valid: false, issues, outputs: [], statePoint: null, curves};
  }

  const pws = saturationVaporPressureKpa(dryBulbC);
  let pv = 0;
  let wKgKg = 0;
  let tWb = dryBulbC;
  let tDp = dryBulbC;
  let rhPct = 100;

  if (mode === 'db-rh') {
    rhPct = relativeHumidityPct;
    pv = (rhPct / 100) * pws;
    wKgKg = humidityRatioFromVaporPressure(pv, pressureKpa);
    tDp = dewPointFromVaporPressure(pv);
    tWb = solveWetBulbC(dryBulbC, wKgKg, pressureKpa);
  } else if (mode === 'db-wb') {
    tWb = wetBulbC;
    wKgKg = humidityRatioFromWetBulb(dryBulbC, tWb, pressureKpa);
    pv = (wKgKg * pressureKpa) / (0.621945 + wKgKg);
    rhPct = Math.min(100, Math.max(0, (pv / pws) * 100));
    tDp = dewPointFromVaporPressure(pv);
    if (pv <= 0.005) {
      issues.push({
        field: 'wetBulbC',
        message: 'Wet-bulb depression exceeds physical dry air limit at this dry-bulb temperature.',
        severity: 'error',
      });
      return {valid: false, issues, outputs: [], statePoint: null, curves};
    }
  } else {
    tDp = dewPointC;
    pv = saturationVaporPressureKpa(tDp);
    wKgKg = humidityRatioFromVaporPressure(pv, pressureKpa);
    rhPct = Math.min(100, Math.max(0, (pv / pws) * 100));
    tWb = solveWetBulbC(dryBulbC, wKgKg, pressureKpa);
  }

  const enthalpyKjKg = moistAirEnthalpyKjKg(dryBulbC, wKgKg);
  const specificVolumeM3Kg = moistAirSpecificVolume(dryBulbC, wKgKg, pressureKpa);
  const wGkg = wKgKg * 1000;

  if (wGkg > 45) {
    issues.push({
      field: 'dryBulbC',
      message: 'Humidity ratio exceeds 45 g/kg chart window; plotted point is clamped at upper chart boundary.',
      severity: 'warning',
    });
  }

  const outputs: OutputMetric[] = [
    {
      id: 'tWb',
      label: 'Wet-Bulb Temperature',
      symbol: 'T_wb',
      value: tWb,
      formatted: tWb.toFixed(2),
      unit: '°C',
      finePrint:
        'Adiabatic saturation temperature solved iteratively via ASHRAE energy balance: h(T_db, W) - h(T_wb, W_s,wb) = (W - W_s,wb)·h_f(T_wb).',
    },
    {
      id: 'tDp',
      label: 'Dew-Point Temperature',
      symbol: 'T_dp',
      value: tDp,
      formatted: tDp.toFixed(2),
      unit: '°C',
      finePrint:
        'Temperature at which water vapor begins condensing at constant pressure and humidity ratio, inverted from Arden Buck saturation correlation.',
    },
    {
      id: 'rh',
      label: 'Relative Humidity',
      symbol: 'φ',
      value: rhPct,
      formatted: rhPct.toFixed(1),
      unit: '%',
      finePrint: 'Ratio of partial vapor pressure p_v to saturation vapor pressure p_ws(T_db) at the same dry-bulb temperature.',
    },
    {
      id: 'w',
      label: 'Humidity Ratio',
      symbol: 'W',
      value: wGkg,
      formatted: wGkg.toFixed(2),
      unit: 'g/kg_da',
      finePrint: 'Mass of water vapor per unit mass of dry air: W = 0.621945 · p_v / (P_atm - p_v).',
    },
    {
      id: 'h',
      label: 'Specific Enthalpy',
      symbol: 'h',
      value: enthalpyKjKg,
      formatted: enthalpyKjKg.toFixed(2),
      unit: 'kJ/kg_da',
      finePrint:
        'Moist air enthalpy referenced to 0 °C dry air and liquid water: h = 1.006·T_db + W·(2501 + 1.86·T_db).',
    },
    {
      id: 'v',
      label: 'Specific Volume',
      symbol: 'v',
      value: specificVolumeM3Kg,
      formatted: specificVolumeM3Kg.toFixed(4),
      unit: 'm³/kg_da',
      finePrint: 'Ideal-gas mixture volume per kg of dry air: v = R_da·T_K·(1 + 1.607858·W) / P_atm.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    statePoint: {
      tDb: dryBulbC,
      tWb,
      tDp,
      rhPct,
      wKgKg,
      wGkg,
      enthalpyKjKg,
      specificVolumeM3Kg,
      vaporPressureKpa: pv,
      satVaporPressureKpa: pws,
    },
    curves,
  };
}

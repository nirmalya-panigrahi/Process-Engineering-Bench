import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface FeCPoint {
  c: number;
  t: number;
}

export interface IronCarbonResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  point: FeCPoint | null;
  tieLine: {
    left: FeCPoint;
    right: FeCPoint;
    leftLabel: string;
    rightLabel: string;
    leftPct: number;
    rightPct: number;
  } | null;
  alloyClass: string;
  phaseRegion: string;
}

// Key boundary functions on Fe-Fe3C diagram
export function lineA3(c: number): number {
  // 0.022% C at 727°C -> 0% C at 912°C, extends from 0 to 0.76% C
  if (c <= 0.022) return 912 - ((912 - 727) * c) / 0.022;
  return 912 - ((912 - 727) * c) / 0.76;
}

export function lineAcm(c: number): number {
  // 0.76% C at 727°C -> 2.14% C at 1147°C
  return 727 + ((1147 - 727) * (c - 0.76)) / (2.14 - 0.76);
}

export function solidusTemp(c: number): number {
  if (c <= 0.17) return 1538 - ((1538 - 1493) * c) / 0.17;
  if (c <= 2.14) return 1493 - ((1493 - 1147) * (c - 0.17)) / (2.14 - 0.17);
  return 1147;
}

export function liquidusTemp(c: number): number {
  if (c <= 0.53) return 1538 - ((1538 - 1493) * c) / 0.53;
  if (c <= 4.3) return 1493 - ((1493 - 1147) * (c - 0.53)) / (4.3 - 0.53);
  return 1147 + ((1500 - 1147) * (c - 4.3)) / (6.67 - 4.3);
}

export function solvusFerrite(t: number): number {
  if (t >= 727) return 0.022;
  return 0.008 + (0.022 - 0.008) * Math.max(0, (t - 200) / (727 - 200));
}

export function calculateIronCarbon(raw: Record<string, number | string>): IronCarbonResult {
  const cPct = Number(raw.carbonPct);
  const tempC = Number(raw.tempC);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(cPct) || cPct < 0 || cPct > 6.67) {
    issues.push({
      field: 'carbonPct',
      message: 'Carbon weight percentage must be between 0.00% and 6.67% (pure Fe₃C).',
      severity: 'error',
    });
  }
  if (!Number.isFinite(tempC) || tempC < 200 || tempC > 1650) {
    issues.push({
      field: 'tempC',
      message: 'Alloy temperature must be between 200 °C and 1650 °C.',
      severity: 'error',
    });
  }

  if (issues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      issues,
      outputs: [],
      point: null,
      tieLine: null,
      alloyClass: '',
      phaseRegion: '',
    };
  }

  let alloyClass = 'Hypoeutectoid Steel';
  if (cPct < 0.022) alloyClass = 'Pure / Ultra-Low-Carbon Iron';
  else if (Math.abs(cPct - 0.76) < 0.02) alloyClass = 'Eutectoid Steel';
  else if (cPct < 0.76) alloyClass = 'Hypoeutectoid Steel';
  else if (cPct <= 2.14) alloyClass = 'Hypereutectoid Steel';
  else if (Math.abs(cPct - 4.3) < 0.05) alloyClass = 'Eutectic Cast Iron';
  else if (cPct < 4.3) alloyClass = 'Hypoeutectic Cast Iron';
  else alloyClass = 'Hypereutectic Cast Iron';

  let phaseRegion = '';
  let tieLine: IronCarbonResult['tieLine'] = null;
  let microNote = 'Equilibrium phases read directly from Fe–Fe₃C tie-line.';

  const tLiq = liquidusTemp(cPct);
  const tSol = solidusTemp(cPct);

  if (tempC >= tLiq) {
    phaseRegion = 'Liquid (L)';
    microNote = 'Completely molten Fe–C solution above the liquidus line.';
  } else if (tempC >= tSol) {
    if (cPct <= 0.53 && tempC >= 1493) {
      const cDelta = Math.max(0, 0.09 * ((1538 - tempC) / (1538 - 1493)));
      const cL = Math.max(0.001, 0.53 * ((1538 - tempC) / (1538 - 1493)));
      phaseRegion = 'δ-Ferrite + Liquid (δ + L)';
      const fL = ((cPct - cDelta) / Math.max(1e-5, cL - cDelta)) * 100;
      tieLine = {
        left: {c: cDelta, t: tempC},
        right: {c: cL, t: tempC},
        leftLabel: 'δ-Ferrite',
        rightLabel: 'Liquid',
        leftPct: Math.max(0, Math.min(100, 100 - fL)),
        rightPct: Math.max(0, Math.min(100, fL)),
      };
    } else if (cPct <= 4.3) {
      const cGamma = 0.17 + ((2.14 - 0.17) * (1493 - tempC)) / (1493 - 1147);
      const cLiq = 0.53 + ((4.3 - 0.53) * (1493 - tempC)) / (1493 - 1147);
      phaseRegion = 'Austenite + Liquid (γ + L)';
      const fL = ((cPct - cGamma) / Math.max(1e-5, cLiq - cGamma)) * 100;
      tieLine = {
        left: {c: cGamma, t: tempC},
        right: {c: cLiq, t: tempC},
        leftLabel: 'γ-Austenite',
        rightLabel: 'Liquid',
        leftPct: Math.max(0, Math.min(100, 100 - fL)),
        rightPct: Math.max(0, Math.min(100, fL)),
      };
    } else {
      const cLiq = 4.3 + ((6.67 - 4.3) * (tempC - 1147)) / (1500 - 1147);
      phaseRegion = 'Liquid + Cementite (L + Fe₃C)';
      const fCem = ((cPct - cLiq) / Math.max(1e-5, 6.67 - cLiq)) * 100;
      tieLine = {
        left: {c: cLiq, t: tempC},
        right: {c: 6.67, t: tempC},
        leftLabel: 'Liquid',
        rightLabel: 'Fe₃C',
        leftPct: Math.max(0, Math.min(100, 100 - fCem)),
        rightPct: Math.max(0, Math.min(100, fCem)),
      };
    }
  } else if (tempC >= 727) {
    // Solid region >= 727°C
    const cAlphaMax = solvusFerrite(tempC);
    if (cPct <= cAlphaMax && tempC <= 912) {
      phaseRegion = 'α-Ferrite (BCC)';
    } else if (cPct <= 0.76 && tempC < lineA3(cPct)) {
      const cGamma = 0.76 * ((912 - tempC) / (912 - 727));
      const cAlpha = 0.022 * ((912 - tempC) / (912 - 727));
      phaseRegion = 'α-Ferrite + γ-Austenite (α + γ)';
      const fGamma = ((cPct - cAlpha) / Math.max(1e-5, cGamma - cAlpha)) * 100;
      tieLine = {
        left: {c: cAlpha, t: tempC},
        right: {c: cGamma, t: tempC},
        leftLabel: 'α-Ferrite',
        rightLabel: 'γ-Austenite',
        leftPct: Math.max(0, Math.min(100, 100 - fGamma)),
        rightPct: Math.max(0, Math.min(100, fGamma)),
      };
    } else if (cPct <= 2.14 && tempC >= (cPct > 0.76 ? lineAcm(cPct) : 727)) {
      phaseRegion = 'γ-Austenite (FCC)';
      microNote = 'Single-phase face-centered cubic austenite solid solution; standard austenitizing window.';
    } else {
      const cGamma = 0.76 + ((2.14 - 0.76) * (tempC - 727)) / (1147 - 727);
      phaseRegion = 'γ-Austenite + Cementite (γ + Fe₃C)';
      const fCem = ((cPct - cGamma) / Math.max(1e-5, 6.67 - cGamma)) * 100;
      tieLine = {
        left: {c: cGamma, t: tempC},
        right: {c: 6.67, t: tempC},
        leftLabel: 'γ-Austenite',
        rightLabel: 'Fe₃C',
        leftPct: Math.max(0, Math.min(100, 100 - fCem)),
        rightPct: Math.max(0, Math.min(100, fCem)),
      };
    }
  } else {
    // Below A1 = 727°C
    const cAlpha = solvusFerrite(tempC);
    if (cPct <= cAlpha) {
      phaseRegion = 'α-Ferrite (BCC)';
    } else {
      phaseRegion = 'α-Ferrite + Cementite (α + Fe₃C)';
      const fCem = ((cPct - cAlpha) / (6.67 - cAlpha)) * 100;
      tieLine = {
        left: {c: cAlpha, t: tempC},
        right: {c: 6.67, t: tempC},
        leftLabel: 'α-Ferrite',
        rightLabel: 'Fe₃C',
        leftPct: Math.max(0, Math.min(100, 100 - fCem)),
        rightPct: Math.max(0, Math.min(100, fCem)),
      };
      if (cPct < 0.76) {
        const pearlitePct = ((cPct - 0.022) / (0.76 - 0.022)) * 100;
        microNote = `Microconstituents: ${(100 - pearlitePct).toFixed(1)}% Proeutectoid α-Ferrite + ${pearlitePct.toFixed(1)}% Pearlite.`;
      } else if (cPct <= 2.14) {
        const pearlitePct = ((6.67 - cPct) / (6.67 - 0.76)) * 100;
        microNote = `Microconstituents: ${pearlitePct.toFixed(1)}% Pearlite + ${(100 - pearlitePct).toFixed(1)}% Proeutectoid Fe₃C.`;
      } else {
        microNote = 'Cast iron microstructure containing Ledeburite / Pearlite + Cementite.';
      }
    }
  }

  const outputs: OutputMetric[] = [
    {
      id: 'alloyClass',
      label: 'Alloy Classification',
      symbol: 'Class',
      value: alloyClass,
      formatted: alloyClass,
      unit: '',
      finePrint:
        'Classified by carbon weight %: Steel (< 2.14 wt% C, eutectoid at 0.76% C) vs Cast Iron (2.14–6.67 wt% C, eutectic at 4.30% C).',
    },
    {
      id: 'phaseRegion',
      label: 'Equilibrium Phases Present',
      symbol: 'Phases',
      value: phaseRegion,
      formatted: phaseRegion,
      unit: '',
      finePrint: microNote,
    },
    {
      id: 'leverLeft',
      label: tieLine ? `${tieLine.leftLabel} Fraction` : 'Primary Phase Fraction',
      symbol: 'W₁',
      value: tieLine ? tieLine.leftPct : 100,
      formatted: tieLine ? `${tieLine.leftPct.toFixed(1)}%` : '100.0%',
      unit: 'wt%',
      finePrint: tieLine
        ? `Lever rule: W₁ = (C_right − C₀) / (C_right − C_left), with tie-line endpoints at ${tieLine.left.c.toFixed(3)}% and ${tieLine.right.c.toFixed(3)}% C.`
        : 'Single-phase field: 100% of alloy exists as one uniform phase.',
    },
    {
      id: 'leverRight',
      label: tieLine ? `${tieLine.rightLabel} Fraction` : 'Secondary Phase Fraction',
      symbol: 'W₂',
      value: tieLine ? tieLine.rightPct : 0,
      formatted: tieLine ? `${tieLine.rightPct.toFixed(1)}%` : '0.0%',
      unit: 'wt%',
      finePrint: tieLine
        ? `Lever rule: W₂ = (C₀ − C_left) / (C_right − C_left). ${microNote}`
        : 'No secondary equilibrium phase present at this temperature and composition.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    point: {c: cPct, t: tempC},
    tieLine,
    alloyClass,
    phaseRegion,
  };
}

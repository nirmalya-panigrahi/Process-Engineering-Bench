import {describe, expect, it} from 'vitest';
import {
  calculateIronCarbon,
  calculateMcCabeThiele,
  calculateMollier,
  calculateMoody,
  calculatePhRefrigeration,
  calculatePowerCycle,
  calculatePsychrometric,
  calculatePumpHead,
  calculateTernaryPhase,
  calculateTtt,
} from '../index';

describe('Engineering Calculation Engines — Blue Pill (Happy Path)', () => {
  it('Psychrometric: computes standard 24°C / 50% RH moist air properties accurately', () => {
    const res = calculatePsychrometric({
      mode: 'db-rh',
      dryBulbC: 24,
      relativeHumidityPct: 50,
      wetBulbC: 17,
      dewPointC: 12,
      pressureKpa: 101.325,
    });
    expect(res.valid).toBe(true);
    expect(res.statePoint).not.toBeNull();
    expect(res.statePoint!.tDp).toBeCloseTo(12.9, 0);
    expect(res.statePoint!.tWb).toBeCloseTo(17.1, 0);
    expect(res.statePoint!.wGkg).toBeGreaterThan(8.5);
    expect(res.statePoint!.wGkg).toBeLessThan(10.0);
    expect(res.curves.saturation.length).toBeGreaterThan(10);
  });

  it('Moody: matches Hagen–Poiseuille 64/Re in laminar flow and Colebrook–White in turbulent flow', () => {
    const lam = calculateMoody({reynolds: 1600, diameterMm: 50, roughnessMm: 0.045});
    expect(lam.valid).toBe(true);
    expect(lam.operatingPoint!.f).toBeCloseTo(64 / 1600, 6);
    expect(lam.operatingPoint!.regime).toContain('Laminar');

    const turb = calculateMoody({reynolds: 120000, diameterMm: 100, roughnessMm: 0.045});
    expect(turb.valid).toBe(true);
    expect(turb.operatingPoint!.f).toBeGreaterThan(0.018);
    expect(turb.operatingPoint!.f).toBeLessThan(0.022);
    expect(turb.operatingPoint!.regime).toContain('Turbulent');
  });

  it('Mollier: computes positive turbine work and moisture quality on expansion', () => {
    const res = calculateMollier({p1Bar: 60, t1C: 480, p2Bar: 0.1, etaPct: 85});
    expect(res.valid).toBe(true);
    expect(res.states!.h1).toBeGreaterThan(res.states!.h2);
    expect(res.states!.h2).toBeGreaterThan(res.states!.h2s);
    expect(res.states!.s2).toBeGreaterThan(res.states!.s1);
  });

  it('P–h Refrigeration: computes realistic COP_R bounded below Carnot COP', () => {
    const res = calculatePhRefrigeration({
      refrigerant: 'R134a',
      tEvapC: -5,
      tCondC: 40,
      superheatC: 5,
      subcoolC: 4,
      etaCompPct: 78,
      massFlowKgS: 0.25,
    });
    expect(res.valid).toBe(true);
    const copMetric = res.outputs.find((o) => o.id === 'cop');
    const cop = Number(copMetric?.value);
    const carnot = (273.15 - 5) / 45;
    expect(cop).toBeGreaterThan(2.0);
    expect(cop).toBeLessThan(carnot);
    expect(res.cyclePoints).toHaveLength(4);
  });

  it('Power Cycles: Otto efficiency matches exact air-standard formula 1 - r^(1-gamma)', () => {
    const res = calculatePowerCycle({
      cycleType: 'otto',
      compressionRatio: 10,
      t1K: 300,
      t3K: 2100,
      p1Kpa: 101.3,
      gamma: 1.4,
    });
    expect(res.valid).toBe(true);
    const etaMetric = res.outputs.find((o) => o.id === 'etaTh');
    const expectedEta = (1 - Math.pow(10, -0.4)) * 100;
    expect(Number(etaMetric?.value)).toBeCloseTo(expectedEta, 1);
    expect(res.states).toHaveLength(4);
  });

  it('McCabe–Thiele: steps finite theoretical trays above R_min and finds feed stage', () => {
    const res = calculateMcCabeThiele({
      alpha: 2.5,
      zF: 0.45,
      xD: 0.94,
      xB: 0.05,
      q: 1.0,
      refluxRatio: 2.2,
    });
    expect(res.valid).toBe(true);
    expect(res.stages.length).toBeGreaterThan(5);
    expect(res.stages.length).toBeLessThan(30);
    expect(res.intersection).not.toBeNull();
  });

  it('Ternary Phase: identifies two-phase miscibility split vs single-phase homogeneous mixture', () => {
    const twoPhase = calculateTernaryPhase({fracA: 0.45, fracB: 0.15, fracC: 0.4, tempC: 25});
    expect(twoPhase.valid).toBe(true);
    expect(twoPhase.regime).toBe('Two-Phase Immiscible');
    expect(twoPhase.activeTieLine).not.toBeNull();

    const singlePhase = calculateTernaryPhase({fracA: 0.25, fracB: 0.55, fracC: 0.2, tempC: 25});
    expect(singlePhase.valid).toBe(true);
    expect(singlePhase.regime).toBe('Single-Phase Homogeneous');
    expect(singlePhase.activeTieLine).toBeNull();
  });

  it('Iron–Carbon: applies Lever Rule at 0.76% eutectoid steel below A1', () => {
    const res = calculateIronCarbon({carbonPct: 0.76, tempC: 650});
    expect(res.valid).toBe(true);
    expect(res.alloyClass).toBe('Eutectoid Steel');
    expect(res.tieLine).not.toBeNull();
    expect(res.tieLine!.leftPct + res.tieLine!.rightPct).toBeCloseTo(100, 3);
  });

  it('TTT Diagram: fast continuous quench in 4340 produces high-hardness Martensite', () => {
    const res = calculateTtt({
      steelGrade: 'AISI-4340',
      pathMode: 'continuous',
      holdTempC: 400,
      holdTimeS: 10,
      coolingRateCS: 100,
    });
    expect(res.valid).toBe(true);
    const micro = res.outputs.find((o) => o.id === 'microstructure');
    const hrc = res.outputs.find((o) => o.id === 'hardness');
    expect(String(micro?.value)).toContain('Martensite');
    expect(Number(hrc?.value)).toBeGreaterThan(50);
  });

  it('Pump & System Head: computes duty point intersection and positive NPSH margin', () => {
    const res = calculatePumpHead({
      speedRatio: 1.0,
      impellerRatio: 1.0,
      shutoffHeadM: 48,
      ratedFlowM3h: 120,
      staticHeadM: 14,
      frictionCoeff: 0.0014,
      npshAvailM: 6.5,
    });
    expect(res.valid).toBe(true);
    expect(res.operatingPoint!.qOpM3h).toBeGreaterThan(80);
    expect(res.operatingPoint!.npshMarginM).toBeGreaterThan(1.0);
  });
});

describe('Engineering Calculation Engines — Red Pill (Adversarial & Edge Cases)', () => {
  it('Psychrometric: rejects wet-bulb higher than dry-bulb and NaN inputs', () => {
    const badWb = calculatePsychrometric({
      mode: 'db-wb',
      dryBulbC: 20,
      relativeHumidityPct: 50,
      wetBulbC: 25,
      dewPointC: 10,
      pressureKpa: 101.325,
    });
    expect(badWb.valid).toBe(false);
    expect(badWb.issues.some((i) => i.severity === 'error')).toBe(true);

    const nanInput = calculatePsychrometric({
      mode: 'db-rh',
      dryBulbC: Number.NaN,
      relativeHumidityPct: 50,
      wetBulbC: 15,
      dewPointC: 10,
      pressureKpa: 101.325,
    });
    expect(nanInput.valid).toBe(false);
  });

  it('Moody: flags transitional Re band with warning and rejects excessive ε/D > 0.08', () => {
    const trans = calculateMoody({reynolds: 3000, diameterMm: 100, roughnessMm: 0.045});
    expect(trans.valid).toBe(true);
    expect(trans.issues.some((i) => i.severity === 'warning')).toBe(true);

    const badRough = calculateMoody({reynolds: 50000, diameterMm: 10, roughnessMm: 2});
    expect(badRough.valid).toBe(false);
  });

  it('Mollier: rejects subcooled liquid inlet and P2 >= P1', () => {
    const subcooled = calculateMollier({p1Bar: 50, t1C: 120, p2Bar: 1, etaPct: 85});
    expect(subcooled.valid).toBe(false);

    const invertedP = calculateMollier({p1Bar: 10, t1C: 400, p2Bar: 15, etaPct: 85});
    expect(invertedP.valid).toBe(false);
  });

  it('P–h Refrigeration: rejects T_cond <= T_evap and supercritical condenser temp', () => {
    const inverted = calculatePhRefrigeration({
      refrigerant: 'R134a',
      tEvapC: 20,
      tCondC: 15,
      superheatC: 5,
      subcoolC: 3,
      etaCompPct: 75,
      massFlowKgS: 0.2,
    });
    expect(inverted.valid).toBe(false);

    const supercrit = calculatePhRefrigeration({
      refrigerant: 'R410A',
      tEvapC: 0,
      tCondC: 75,
      superheatC: 5,
      subcoolC: 3,
      etaCompPct: 75,
      massFlowKgS: 0.2,
    });
    expect(supercrit.valid).toBe(false);
  });

  it('McCabe–Thiele: detects pinch condition when R <= R_min', () => {
    const pinch = calculateMcCabeThiele({
      alpha: 2.0,
      zF: 0.45,
      xD: 0.95,
      xB: 0.05,
      q: 1.0,
      refluxRatio: 0.4,
    });
    expect(pinch.valid).toBe(false);
    expect(pinch.issues[0].message.toLowerCase()).toContain('minimum reflux');
  });

  it('Ternary Phase: rejects all-zero fractions and negative composition', () => {
    const zeroSum = calculateTernaryPhase({fracA: 0, fracB: 0, fracC: 0, tempC: 25});
    expect(zeroSum.valid).toBe(false);

    const neg = calculateTernaryPhase({fracA: -0.2, fracB: 0.5, fracC: 0.7, tempC: 25});
    expect(neg.valid).toBe(false);
  });

  it('Iron–Carbon: rejects carbon > 6.67 wt% cementite bound', () => {
    const over = calculateIronCarbon({carbonPct: 7.5, tempC: 800});
    expect(over.valid).toBe(false);
  });

  it('Pump & System Head: detects dead-head condition when static head >= shutoff head', () => {
    const deadHead = calculatePumpHead({
      speedRatio: 0.6,
      impellerRatio: 1.0,
      shutoffHeadM: 40,
      ratedFlowM3h: 100,
      staticHeadM: 30, // 40 * 0.36 = 14.4m < 30m
      frictionCoeff: 0.001,
      npshAvailM: 6,
    });
    expect(deadHead.valid).toBe(false);
    expect(deadHead.issues[0].message.toLowerCase()).toContain('dead-head');
  });
});

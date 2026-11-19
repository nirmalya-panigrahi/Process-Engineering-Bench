import type {OutputMetric, ValidationIssue} from '../types/bench';

export interface PointXY {
  x: number;
  y: number;
}

export interface McCabeThieleResult {
  valid: boolean;
  issues: ValidationIssue[];
  outputs: OutputMetric[];
  vleCurve: PointXY[];
  diagonal: PointXY[];
  rectifyingLine: PointXY[];
  strippingLine: PointXY[];
  qLine: PointXY[];
  stages: {
    horizontal: PointXY[];
    vertical: PointXY[];
    stageNumber: number;
    section: 'rectifying' | 'stripping';
  }[];
  intersection: PointXY | null;
}

export function vleY(x: number, alpha: number): number {
  return (alpha * x) / (1 + (alpha - 1) * x);
}

export function vleX(y: number, alpha: number): number {
  return y / (alpha - (alpha - 1) * y);
}

function solveQLineVleIntersection(zF: number, q: number, alpha: number): PointXY {
  if (Math.abs(q - 1) < 1e-5) {
    return {x: zF, y: vleY(zF, alpha)};
  }
  if (Math.abs(q) < 1e-5) {
    return {x: vleX(zF, alpha), y: zF};
  }
  const m = q / (q - 1);
  const b = -zF / (q - 1);
  // m*x + b = alpha*x / (1 + (alpha-1)*x)
  const A = m * (alpha - 1);
  const B = m + b * (alpha - 1) - alpha;
  const C = b;
  const disc = Math.max(0, B * B - 4 * A * C);
  const r1 = (-B + Math.sqrt(disc)) / (2 * A);
  const r2 = (-B - Math.sqrt(disc)) / (2 * A);
  const x = r1 > 0 && r1 < 1 ? r1 : r2;
  const clampedX = Math.max(0.0001, Math.min(0.9999, x));
  return {x: clampedX, y: vleY(clampedX, alpha)};
}

export function calculateMcCabeThiele(raw: Record<string, number | string>): McCabeThieleResult {
  const alpha = Number(raw.alpha);
  const zF = Number(raw.zF);
  const xD = Number(raw.xD);
  const xB = Number(raw.xB);
  const q = Number(raw.q);
  const refluxRatio = Number(raw.refluxRatio);

  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(alpha) || alpha <= 1.05 || alpha > 12) {
    issues.push({
      field: 'alpha',
      message: 'Relative volatility α must be > 1.05 and ≤ 12.0.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(xB) || xB <= 0.001 || xB >= 0.9) {
    issues.push({
      field: 'xB',
      message: 'Bottoms composition x_B must be between 0.001 and 0.90.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(xD) || xD <= 0.1 || xD >= 0.999) {
    issues.push({
      field: 'xD',
      message: 'Distillate purity x_D must be between 0.10 and 0.999.',
      severity: 'error',
    });
  }
  if (!Number.isFinite(zF) || zF <= xB || zF >= xD) {
    issues.push({
      field: 'zF',
      message: 'Feed mole fraction z_F must lie strictly between x_B and x_D (x_B < z_F < x_D).',
      severity: 'error',
    });
  }
  if (!Number.isFinite(q) || q < -0.2 || q > 1.4) {
    issues.push({
      field: 'q',
      message: 'Feed thermal quality q must be between -0.2 (superheated vapor) and 1.4 (subcooled liquid).',
      severity: 'error',
    });
  }
  if (!Number.isFinite(refluxRatio) || refluxRatio <= 0.05 || refluxRatio > 30) {
    issues.push({
      field: 'refluxRatio',
      message: 'Reflux ratio R must be > 0.05 and ≤ 30.',
      severity: 'error',
    });
  }

  const vleCurve: PointXY[] = [];
  const safeAlpha = Number.isFinite(alpha) && alpha > 1 ? alpha : 2.5;
  for (let i = 0; i <= 50; i++) {
    const x = i / 50;
    vleCurve.push({x, y: vleY(x, safeAlpha)});
  }
  const diagonal: PointXY[] = [
    {x: 0, y: 0},
    {x: 1, y: 1},
  ];

  if (issues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      issues,
      outputs: [],
      vleCurve,
      diagonal,
      rectifyingLine: [],
      strippingLine: [],
      qLine: [],
      stages: [],
      intersection: null,
    };
  }

  const pinch = solveQLineVleIntersection(zF, q, alpha);
  const rMin = Math.max(0.01, (xD - pinch.y) / Math.max(1e-6, pinch.y - pinch.x));

  if (refluxRatio <= rMin * 1.005) {
    issues.push({
      field: 'refluxRatio',
      message: `Reflux ratio R = ${refluxRatio.toFixed(2)} is at or below minimum reflux R_min = ${rMin.toFixed(2)} (pinch condition — infinite stages required). Increase R above ${rMin.toFixed(2)}.`,
      severity: 'error',
    });
    return {
      valid: false,
      issues,
      outputs: [],
      vleCurve,
      diagonal,
      rectifyingLine: [],
      strippingLine: [],
      qLine: [
        {x: zF, y: zF},
        pinch,
      ],
      stages: [],
      intersection: null,
    };
  }

  // Intersection of rectifying line y = mR*x + bR and q-line
  const mR = refluxRatio / (refluxRatio + 1);
  const bR = xD / (refluxRatio + 1);
  let xInt: number;
  let yInt: number;
  if (Math.abs(q - 1) < 1e-5) {
    xInt = zF;
    yInt = mR * xInt + bR;
  } else if (Math.abs(q) < 1e-5) {
    yInt = zF;
    xInt = (yInt - bR) / mR;
  } else {
    const mQ = q / (q - 1);
    const bQ = -zF / (q - 1);
    xInt = (bR - bQ) / (mQ - mR);
    yInt = mR * xInt + bR;
  }

  const mS = (yInt - xB) / Math.max(1e-6, xInt - xB);
  const bS = xB - mS * xB;

  const rectifyingLine: PointXY[] = [
    {x: xInt, y: yInt},
    {x: xD, y: xD},
  ];
  const strippingLine: PointXY[] = [
    {x: xB, y: xB},
    {x: xInt, y: yInt},
  ];
  const qLine: PointXY[] = [
    {x: zF, y: zF},
    {x: xInt, y: yInt},
  ];

  // Step off equilibrium stages from (xD, xD)
  const stages: McCabeThieleResult['stages'] = [];
  let currX = xD;
  let currY = xD;
  let feedTray = 1;
  let switched = false;
  let totalStages = 0;

  for (let step = 1; step <= 80; step++) {
    const eqX = vleX(currY, alpha);
    const section: 'rectifying' | 'stripping' = eqX >= xInt ? 'rectifying' : 'stripping';
    if (!switched && section === 'stripping') {
      feedTray = step;
      switched = true;
    }

    const nextY = section === 'rectifying' ? mR * eqX + bR : mS * eqX + bS;
    if (eqX <= xB) {
      // Fractional final tray
      const frac = Math.max(0.05, Math.min(1, (currX - xB) / Math.max(1e-6, currX - eqX)));
      totalStages = step - 1 + frac;
      stages.push({
        horizontal: [
          {x: currX, y: currY},
          {x: eqX, y: currY},
        ],
        vertical: [
          {x: eqX, y: currY},
          {x: eqX, y: eqX},
        ],
        stageNumber: step,
        section,
      });
      break;
    }

    stages.push({
      horizontal: [
        {x: currX, y: currY},
        {x: eqX, y: currY},
      ],
      vertical: [
        {x: eqX, y: currY},
        {x: eqX, y: nextY},
      ],
      stageNumber: step,
      section,
    });

    currX = eqX;
    currY = nextY;
    totalStages = step;
  }

  const nMin = Math.log((xD * (1 - xB)) / (xB * (1 - xD))) / Math.log(alpha);
  const integerTrays = Math.ceil(totalStages);
  const rRatioToMin = refluxRatio / rMin;

  if (rRatioToMin < 1.1) {
    issues.push({
      field: 'refluxRatio',
      message: `Operating close to R_min (R/R_min = ${rRatioToMin.toFixed(2)}); column requires many stages. Typical heuristic is 1.2–1.5 × R_min.`,
      severity: 'warning',
    });
  }

  const outputs: OutputMetric[] = [
    {
      id: 'rMin',
      label: 'Minimum Reflux Ratio',
      symbol: 'R_min',
      value: rMin,
      formatted: rMin.toFixed(3),
      unit: '–',
      finePrint: `Pinch intersection of q-line and VLE curve at (${pinch.x.toFixed(3)}, ${pinch.y.toFixed(3)}): R_min = (x_D − y_q)/(y_q − x_q).`,
    },
    {
      id: 'nMin',
      label: 'Minimum Theoretical Stages',
      symbol: 'N_min',
      value: nMin,
      formatted: nMin.toFixed(2),
      unit: 'stages',
      finePrint: 'Total-reflux limit calculated via Fenske equation: ln[(x_D(1−x_B))/(x_B(1−x_D))] / ln(α).',
    },
    {
      id: 'nStages',
      label: 'Theoretical Trays Required',
      symbol: 'N_th',
      value: totalStages,
      formatted: `${totalStages.toFixed(1)} (${integerTrays} trays)`,
      unit: 'stages',
      status: totalStages > 40 ? 'warning' : 'nominal',
      statusLabel: `R/R_min = ${rRatioToMin.toFixed(2)}`,
      finePrint:
        'Includes partial reboiler as the final equilibrium stage; step-by-step graphical construction from (x_D, x_D) down to x_B.',
    },
    {
      id: 'feedTray',
      label: 'Optimal Feed Tray',
      symbol: 'N_feed',
      value: feedTray,
      formatted: `Tray ${feedTray} from top`,
      unit: '',
      finePrint: 'Stage where stepped composition crosses the q-line / rectifying-to-stripping intersection.',
    },
  ];

  return {
    valid: true,
    issues,
    outputs,
    vleCurve,
    diagonal,
    rectifyingLine,
    strippingLine,
    qLine,
    stages,
    intersection: {x: xInt, y: yInt},
  };
}

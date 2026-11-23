import type {TernaryComp, TernaryResult} from '../../engines/ternaryPhase';
import {
  ChartCursorTooltip,
  ChartFrame,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface TernaryPhaseChartProps {
  result: TernaryResult;
  finePrint: string;
}

const W = 560;
const H = 470;
const M = {top: 40, right: 56, bottom: 52, left: 56};

const BASE_W = W - M.left - M.right;
const TRI_H = (BASE_W * Math.sqrt(3)) / 2;
const TOP_Y = H - M.bottom - TRI_H;

function baryToXY(comp: TernaryComp): {x: number; y: number} {
  // Bottom-left: A (1,0,0), Bottom-right: C (0,0,1), Top: B (0,1,0)
  const x = M.left + (comp.c + 0.5 * comp.b) * BASE_W;
  const y = H - M.bottom - comp.b * TRI_H;
  return {x, y};
}

function xyToBary(svgX: number, svgY: number): TernaryComp | null {
  const b = (H - M.bottom - svgY) / TRI_H;
  const c = (svgX - M.left) / BASE_W - 0.5 * b;
  const a = 1 - b - c;
  if (a < -0.01 || b < -0.01 || c < -0.01) return null;
  return {
    a: Math.max(0, a),
    b: Math.max(0, b),
    c: Math.max(0, c),
  };
}

export function TernaryPhaseChart({result, finePrint}: TernaryPhaseChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const cursorBary = cursor ? xyToBary(cursor.svgX, cursor.svgY) : null;
  const readout = cursorBary
    ? `A: ${(cursorBary.a * 100).toFixed(0)}% · B: ${(cursorBary.b * 100).toFixed(0)}% · C: ${(cursorBary.c * 100).toFixed(0)}%`
    : result.mixture
      ? `Feed: A ${(result.mixture.a * 100).toFixed(1)}% · B ${(result.mixture.b * 100).toFixed(1)}% · C ${(result.mixture.c * 100).toFixed(1)}%`
      : null;

  const binodalPts = result.binodalCurve.map(baryToXY);
  const gridSteps = [0.2, 0.4, 0.6, 0.8];

  const vA = baryToXY({a: 1, b: 0, c: 0});
  const vB = baryToXY({a: 0, b: 1, c: 0});
  const vC = baryToXY({a: 0, b: 0, c: 1});

  const cursorTooltipRows = cursorBary
    ? [
        {label: 'A (Carrier)', value: `${(cursorBary.a * 100).toFixed(1)}%`},
        {label: 'B (Solute)', value: `${(cursorBary.b * 100).toFixed(1)}%`},
        {label: 'C (Solvent)', value: `${(cursorBary.c * 100).toFixed(1)}%`},
      ]
    : [];

  return (
    <ChartFrame
      title="Equilateral Ternary Phase Diagram (A–B–C)"
      subtitle="Barycentric miscibility envelope, conjugate tie-lines, and phase split"
      finePrintTitle="Ternary Barycentric Coordinates"
      finePrintBody={finePrint}
      finePrintDataValues={
        result.mixture
          ? [
              {
                label: 'Feed (A/B/C)',
                value: `${(result.mixture.a * 100).toFixed(1)}% / ${(result.mixture.b * 100).toFixed(1)}% / ${(result.mixture.c * 100).toFixed(1)}%`,
              },
              {label: 'Phase Regime', value: result.regime ?? '—'},
              {
                label: 'Plait Point B',
                value: `${(result.plaitPoint.b * 100).toFixed(1)}%`,
              },
            ]
          : undefined
      }
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Binodal Miscibility Curve
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-cyan-600" /> Equilibrium Tie-Lines
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> Active Mixture Tie-Line
          </span>
        </>
      }
    >
      <div className="relative mx-auto max-w-[560px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Equilateral ternary phase diagram"
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          {/* Triangle fill */}
          <polygon
            points={`${vA.x},${vA.y} ${vB.x},${vB.y} ${vC.x},${vC.y}`}
            fill="#FFFFFF"
            stroke="#334155"
            strokeWidth={1.75}
          />

          {/* Barycentric grid lines */}
          {gridSteps.map((f) => {
            // Constant B (horizontal)
            const b1 = baryToXY({a: 1 - f, b: f, c: 0});
            const b2 = baryToXY({a: 0, b: f, c: 1 - f});
            // Constant A
            const a1 = baryToXY({a: f, b: 1 - f, c: 0});
            const a2 = baryToXY({a: f, b: 0, c: 1 - f});
            // Constant C
            const c1 = baryToXY({a: 1 - f, b: 0, c: f});
            const c2 = baryToXY({a: 0, b: 1 - f, c: f});
            return (
              <g key={f}>
                <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} stroke="#E2E8F0" strokeWidth={1} />
                <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="#E2E8F0" strokeWidth={1} />
                <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#E2E8F0" strokeWidth={1} />
                <text x={b1.x - 8} y={b1.y + 3} textAnchor="end" className="fill-slate-400 font-mono text-[9px]">
                  {(f * 100).toFixed(0)}%
                </text>
                <text x={c1.x} y={c1.y + 15} textAnchor="middle" className="fill-slate-400 font-mono text-[9px]">
                  {(f * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Two-phase binodal dome shading */}
          <polygon points={pointsToPolyline(binodalPts)} fill="#DBEAFE" opacity={0.45} />

          {/* Background tie-lines */}
          {result.tieLines.map((tl, i) => {
            const p1 = baryToXY(tl.raffinate);
            const p2 = baryToXY(tl.extract);
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#0891B2"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.75}
              />
            );
          })}

          {/* Binodal curve */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            points={pointsToPolyline(binodalPts)}
          />

          {/* Plait point */}
          {(() => {
            const pp = baryToXY(result.plaitPoint);
            return <circle cx={pp.x} cy={pp.y} r={3.5} fill="#2563EB" />;
          })()}

          {/* Active tie-line if two-phase */}
          {result.activeTieLine && (
            <g>
              {(() => {
                const pR = baryToXY(result.activeTieLine.raffinate);
                const pE = baryToXY(result.activeTieLine.extract);
                return (
                  <>
                    <line
                      x1={pR.x}
                      y1={pR.y}
                      x2={pE.x}
                      y2={pE.y}
                      stroke="#E11D48"
                      strokeWidth={2.25}
                    />
                    <circle cx={pR.x} cy={pR.y} r={4.5} fill="#0F172A" stroke="#FFF" strokeWidth={1.5} />
                    <text x={pR.x - 8} y={pR.y - 6} textAnchor="end" className="fill-slate-800 font-mono text-[9px] font-semibold">
                      Raffinate
                    </text>
                    <circle cx={pE.x} cy={pE.y} r={4.5} fill="#0F172A" stroke="#FFF" strokeWidth={1.5} />
                    <text x={pE.x + 8} y={pE.y - 6} textAnchor="start" className="fill-slate-800 font-mono text-[9px] font-semibold">
                      Extract
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* User mixture point */}
          {result.mixture && (
            <g>
              {(() => {
                const pm = baryToXY(result.mixture);
                return (
                  <>
                    <circle cx={pm.x} cy={pm.y} r={6} fill="#E11D48" stroke="#FFFFFF" strokeWidth={2} />
                    <text
                      x={pm.x + 9}
                      y={pm.y - 8}
                      className="fill-rose-700 font-mono text-[10px] font-semibold"
                    >
                      Mix
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Vertex Labels */}
          <text x={vB.x} y={TOP_Y - 14} textAnchor="middle" className="fill-slate-900 text-xs font-semibold">
            B · Solute (100%)
          </text>
          <text x={vA.x - 10} y={vA.y + 22} textAnchor="start" className="fill-slate-900 text-xs font-semibold">
            A · Carrier (100%)
          </text>
          <text x={vC.x + 10} y={vC.y + 22} textAnchor="end" className="fill-slate-900 text-xs font-semibold">
            C · Solvent (100%)
          </text>
        </svg>
        {cursor && cursorBary && (
          <ChartCursorTooltip
            svgX={cursor.svgX}
            svgY={cursor.svgY}
            viewWidth={W}
            viewHeight={H}
            title="Ternary Composition Probe"
            rows={cursorTooltipRows}
          />
        )}
      </div>
    </ChartFrame>
  );
}

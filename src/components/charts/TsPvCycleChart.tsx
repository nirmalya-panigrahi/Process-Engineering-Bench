import type {PowerCycleResult} from '../../engines/powerCycles';
import {
  ChartFrame,
  createLinearMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface TsPvCycleChartProps {
  result: PowerCycleResult;
  finePrint: string;
}

const W = 380;
const H = 340;
const M = {top: 24, right: 20, bottom: 44, left: 56};

export function TsPvCycleChart({result, finePrint}: TsPvCycleChartProps) {
  const pvCross = useSvgCrosshair(W, H, M);
  const tsCross = useSvgCrosshair(W, H, M);

  const pts = result.loopPoints;
  const states = result.states;

  if (!result.valid || pts.length === 0) {
    return (
      <ChartFrame
        title="T–s & P–v Thermodynamic Cycle Diagrams"
        subtitle="Synchronized mechanical (P–v) and thermal (T–s) state loops"
        finePrintTitle="Power Cycle Thermodynamics"
        finePrintBody={finePrint}
      >
        <div className="flex h-64 items-center justify-center text-xs text-slate-500">
          Enter valid cycle parameters to render P–v and T–s state loops.
        </div>
      </ChartFrame>
    );
  }

  const vMin = 0;
  const vMax = Math.max(...pts.map((p) => p.vM3Kg)) * 1.1;
  const pMin = 0;
  const pMax = Math.max(...pts.map((p) => p.pKpa)) * 1.12;

  const sMin = Math.min(...pts.map((p) => p.sKjKgK)) - 0.15;
  const sMax = Math.max(...pts.map((p) => p.sKjKgK)) + 0.15;
  const tMin = Math.min(...pts.map((p) => p.tK)) * 0.82;
  const tMax = Math.max(...pts.map((p) => p.tK)) * 1.1;

  const mapVx = createLinearMapper(vMin, vMax, M.left, W - M.right);
  const mapPy = createLinearMapper(pMin, pMax, H - M.bottom, M.top);

  const mapSx = createLinearMapper(sMin, sMax, M.left, W - M.right);
  const mapTy = createLinearMapper(tMin, tMax, H - M.bottom, M.top);

  const pvPoly = pointsToPolyline([...pts, pts[0]].map((p) => ({x: mapVx(p.vM3Kg), y: mapPy(p.pKpa)})));
  const tsPoly = pointsToPolyline([...pts, pts[0]].map((p) => ({x: mapSx(p.sKjKgK), y: mapTy(p.tK)})));

  return (
    <ChartFrame
      title={`T–s & P–v Cycle Diagrams (${result.cycleType.toUpperCase()})`}
      subtitle="Enclosed loop area on both planes equals specific net cycle work"
      finePrintTitle="Power Cycle Loop Equivalence"
      finePrintBody={finePrint}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> P–v Work Loop
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> T–s Entropy Loop
          </span>
          <span>States 1→2→3→4 numbered</span>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* P-v plot */}
        <div className="rounded border border-slate-100 bg-slate-50/40 p-2">
          <div className="px-1 pb-1 font-mono text-[11px] font-semibold text-slate-700">
            P–v Plane (Pressure vs. Specific Volume)
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Pressure versus specific volume cycle diagram"
            className="w-full h-auto cursor-crosshair select-none"
            onMouseMove={pvCross.onMouseMove}
            onMouseLeave={pvCross.onMouseLeave}
          >
            {[0.25, 0.5, 0.75, 1].map((f) => {
              const vVal = vMin + f * (vMax - vMin);
              const pVal = pMin + f * (pMax - pMin);
              return (
                <g key={f}>
                  <line x1={mapVx(vVal)} y1={M.top} x2={mapVx(vVal)} y2={H - M.bottom} stroke="#E2E8F0" />
                  <text x={mapVx(vVal)} y={H - M.bottom + 15} textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
                    {vVal.toFixed(2)}
                  </text>
                  <line x1={M.left} y1={mapPy(pVal)} x2={W - M.right} y2={mapPy(pVal)} stroke="#E2E8F0" />
                  <text x={M.left - 6} y={mapPy(pVal) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[9px]">
                    {pVal.toFixed(0)}
                  </text>
                </g>
              );
            })}

            <polygon points={pvPoly} fill="#2563EB" fillOpacity={0.12} stroke="#2563EB" strokeWidth={2.25} />
            {states.map((st) => (
              <g key={`pv-${st.id}`}>
                <circle cx={mapVx(st.vM3Kg)} cy={mapPy(st.pKpa)} r={4.5} fill="#1E40AF" stroke="#FFF" strokeWidth={1.5} />
                <text x={mapVx(st.vM3Kg) + 7} y={mapPy(st.pKpa) - 5} className="fill-slate-900 font-mono text-[10px] font-semibold">
                  {st.id}
                </text>
              </g>
            ))}

            {pvCross.cursor && (
              <g pointerEvents="none">
                <line x1={pvCross.cursor.svgX} y1={M.top} x2={pvCross.cursor.svgX} y2={H - M.bottom} stroke="#64748B" strokeDasharray="2 2" />
                <line x1={M.left} y1={pvCross.cursor.svgY} x2={W - M.right} y2={pvCross.cursor.svgY} stroke="#64748B" strokeDasharray="2 2" />
              </g>
            )}

            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="none" stroke="#94A3B8" />
            <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" className="fill-slate-600 text-[10px] font-medium">
              Specific Volume v (m³/kg)
            </text>
            <text
              x={14}
              y={(M.top + H - M.bottom) / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`}
              className="fill-slate-600 text-[10px] font-medium"
            >
              Pressure P (kPa)
            </text>
          </svg>
        </div>

        {/* T-s plot */}
        <div className="rounded border border-slate-100 bg-slate-50/40 p-2">
          <div className="px-1 pb-1 font-mono text-[11px] font-semibold text-slate-700">
            T–s Plane (Temperature vs. Entropy)
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Temperature versus entropy cycle diagram"
            className="w-full h-auto cursor-crosshair select-none"
            onMouseMove={tsCross.onMouseMove}
            onMouseLeave={tsCross.onMouseLeave}
          >
            {[0.2, 0.4, 0.6, 0.8].map((f) => {
              const sVal = sMin + f * (sMax - sMin);
              const tVal = tMin + f * (tMax - tMin);
              return (
                <g key={f}>
                  <line x1={mapSx(sVal)} y1={M.top} x2={mapSx(sVal)} y2={H - M.bottom} stroke="#E2E8F0" />
                  <text x={mapSx(sVal)} y={H - M.bottom + 15} textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
                    {sVal.toFixed(2)}
                  </text>
                  <line x1={M.left} y1={mapTy(tVal)} x2={W - M.right} y2={mapTy(tVal)} stroke="#E2E8F0" />
                  <text x={M.left - 6} y={mapTy(tVal) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[9px]">
                    {tVal.toFixed(0)}
                  </text>
                </g>
              );
            })}

            <polygon points={tsPoly} fill="#E11D48" fillOpacity={0.12} stroke="#E11D48" strokeWidth={2.25} />
            {states.map((st) => (
              <g key={`ts-${st.id}`}>
                <circle cx={mapSx(st.sKjKgK)} cy={mapTy(st.tK)} r={4.5} fill="#BE123C" stroke="#FFF" strokeWidth={1.5} />
                <text x={mapSx(st.sKjKgK) + 7} y={mapTy(st.tK) - 5} className="fill-slate-900 font-mono text-[10px] font-semibold">
                  {st.id}
                </text>
              </g>
            ))}

            {tsCross.cursor && (
              <g pointerEvents="none">
                <line x1={tsCross.cursor.svgX} y1={M.top} x2={tsCross.cursor.svgX} y2={H - M.bottom} stroke="#64748B" strokeDasharray="2 2" />
                <line x1={M.left} y1={tsCross.cursor.svgY} x2={W - M.right} y2={tsCross.cursor.svgY} stroke="#64748B" strokeDasharray="2 2" />
              </g>
            )}

            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="none" stroke="#94A3B8" />
            <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" className="fill-slate-600 text-[10px] font-medium">
              Specific Entropy s (kJ/kg·K)
            </text>
            <text
              x={14}
              y={(M.top + H - M.bottom) / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`}
              className="fill-slate-600 text-[10px] font-medium"
            >
              Temperature T (K)
            </text>
          </svg>
        </div>
      </div>
    </ChartFrame>
  );
}

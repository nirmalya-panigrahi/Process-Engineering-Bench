import type {PumpHeadResult} from '../../engines/pumpHead';
import {
  ChartFrame,
  createInverseLinearMapper,
  createLinearMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface PumpHeadChartProps {
  result: PumpHeadResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 60, bottom: 48, left: 60};

export function PumpHeadChart({result, finePrint}: PumpHeadChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const pts = result.curves;
  if (pts.length === 0) {
    return (
      <ChartFrame
        title="Pump & System Head Curve"
        subtitle="Overlay of affinity-scaled pump curve, system resistance, and efficiency"
        finePrintTitle="Pump Operating Duty Point"
        finePrintBody={finePrint}
      >
        <div className="flex h-64 items-center justify-center text-xs text-slate-500">
          Enter valid pump and piping parameters to generate H–Q curves.
        </div>
      </ChartFrame>
    );
  }

  const qMax = Math.max(...pts.map((p) => p.qM3h));
  const hMax = Math.max(
    ...pts.map((p) => Math.max(p.hPumpM, p.hSysM * 0.85)),
    10,
  ) * 1.1;

  const mapX = createLinearMapper(0, qMax, M.left, W - M.right);
  const mapY = createLinearMapper(0, hMax, H - M.bottom, M.top);
  const mapEtaY = createLinearMapper(0, 100, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(0, qMax, M.left, W - M.right);
  const invY = createInverseLinearMapper(0, hMax, H - M.bottom, M.top);

  const op = result.operatingPoint;
  const readout = cursor
    ? `Q: ${invX(cursor.svgX).toFixed(1)} m³/h · H: ${invY(cursor.svgY).toFixed(1)} m`
    : op
      ? `Duty: ${op.qOpM3h.toFixed(1)} m³/h @ ${op.hOpM.toFixed(1)} m (${op.etaOpPct.toFixed(0)}%)`
      : null;

  const fracTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <ChartFrame
      title="Pump Performance & System Resistance Curve (H–Q)"
      subtitle="Affinity-scaled pump head curve intersecting piping friction curve with efficiency overlay"
      finePrintTitle="Pump & System Curve Matching"
      finePrintBody={finePrint}
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Pump Head H(Q)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-amber-600" /> System Curve H_sys(Q)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-emerald-600" /> Efficiency η (%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Operating Duty Point
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Pump performance and system head curve"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <clipPath id="pump-clip">
            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
          </clipPath>
        </defs>

        {fracTicks.map((f) => {
          const qv = f * qMax;
          const hv = f * hMax;
          const ev = f * 100;
          return (
            <g key={f}>
              <line x1={mapX(qv)} y1={M.top} x2={mapX(qv)} y2={H - M.bottom} stroke="#E2E8F0" />
              <text x={mapX(qv)} y={H - M.bottom + 18} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
                {qv.toFixed(0)}
              </text>
              <line x1={M.left} y1={mapY(hv)} x2={W - M.right} y2={mapY(hv)} stroke="#E2E8F0" />
              <text x={M.left - 8} y={mapY(hv) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
                {hv.toFixed(0)}
              </text>
              <text x={W - M.right + 8} y={mapEtaY(ev) + 3} textAnchor="start" className="fill-emerald-700 font-mono text-[10px]">
                {ev.toFixed(0)}%
              </text>
            </g>
          );
        })}

        <g clipPath="url(#pump-clip)">
          {/* Efficiency curve */}
          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth={1.75}
            strokeDasharray="5 3"
            points={pointsToPolyline(pts.map((p) => ({x: mapX(p.qM3h), y: mapEtaY(p.etaPct)})))}
          />

          {/* System curve */}
          <polyline
            fill="none"
            stroke="#D97706"
            strokeWidth={2.5}
            points={pointsToPolyline(pts.map((p) => ({x: mapX(p.qM3h), y: mapY(p.hSysM)})))}
          />

          {/* Pump curve */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.75}
            points={pointsToPolyline(pts.map((p) => ({x: mapX(p.qM3h), y: mapY(p.hPumpM)})))}
          />

          {/* Operating duty point */}
          {op && (
            <g>
              <line
                x1={mapX(op.qOpM3h)}
                y1={mapY(op.hOpM)}
                x2={mapX(op.qOpM3h)}
                y2={H - M.bottom}
                stroke="#E11D48"
                strokeDasharray="3 3"
              />
              <line
                x1={M.left}
                y1={mapY(op.hOpM)}
                x2={mapX(op.qOpM3h)}
                y2={mapY(op.hOpM)}
                stroke="#E11D48"
                strokeDasharray="3 3"
              />
              <circle
                cx={mapX(op.qOpM3h)}
                cy={mapEtaY(op.etaOpPct)}
                r={4.5}
                fill="#059669"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <circle
                cx={mapX(op.qOpM3h)}
                cy={mapY(op.hOpM)}
                r={6}
                fill="#E11D48"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <text
                x={Math.min(W - M.right - 105, mapX(op.qOpM3h) + 10)}
                y={Math.max(M.top + 16, mapY(op.hOpM) - 10)}
                className="fill-slate-900 font-mono text-[10px] font-semibold"
              >
                {`(${op.qOpM3h.toFixed(1)} m³/h, ${op.hOpM.toFixed(1)} m)`}
              </text>
            </g>
          )}
        </g>

        {cursor && (
          <g pointerEvents="none">
            <line x1={cursor.svgX} y1={M.top} x2={cursor.svgX} y2={H - M.bottom} stroke="#64748B" strokeDasharray="2 2" />
            <line x1={M.left} y1={cursor.svgY} x2={W - M.right} y2={cursor.svgY} stroke="#64748B" strokeDasharray="2 2" />
          </g>
        )}

        <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="none" stroke="#94A3B8" />
        <text x={(M.left + W - M.right) / 2} y={H - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-medium">
          Volumetric Flow Rate Q (m³/h)
        </text>
        <text
          x={16}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Total Head H (m)
        </text>
        <text
          x={W - 12}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${W - 12} ${(M.top + H - M.bottom) / 2})`}
          className="fill-emerald-700 text-[11px] font-medium"
        >
          Pump Efficiency η (%)
        </text>
      </svg>
    </ChartFrame>
  );
}

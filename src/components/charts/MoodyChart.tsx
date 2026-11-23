import {darcyFrictionFactor, type MoodyResult} from '../../engines/moody';
import {
  ChartCursorTooltip,
  ChartFrame,
  createInverseLogMapper,
  createLogMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface MoodyChartProps {
  result: MoodyResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 64, bottom: 48, left: 58};

export function MoodyChart({result, finePrint}: MoodyChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const mapX = createLogMapper(500, 1e8, M.left, W - M.right);
  const mapY = createLogMapper(0.008, 0.1, H - M.bottom, M.top);
  const invX = createInverseLogMapper(500, 1e8, M.left, W - M.right);
  const invY = createInverseLogMapper(0.008, 0.1, H - M.bottom, M.top);

  const readout = cursor
    ? `Re: ${invX(cursor.svgX).toExponential(2)} · f: ${invY(cursor.svgY).toFixed(4)}`
    : result.operatingPoint
      ? `Re: ${result.operatingPoint.re.toExponential(2)} · f: ${result.operatingPoint.f.toFixed(4)}`
      : null;

  const reTicks = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8];
  const fTicks = [0.01, 0.015, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1];

  const op = result.operatingPoint;

  const cursorTooltipRows = cursor
    ? (() => {
        const reVal = invX(cursor.svgX);
        const fCursor = invY(cursor.svgY);
        const relR = op ? op.relRoughness : 0.00045;
        const fCurve = darcyFrictionFactor(reVal, relR);
        return [
          {label: 'Reynolds Re', value: reVal.toExponential(2)},
          {label: 'Cursor f', value: fCursor.toFixed(5)},
          {label: 'Pipe Curve f', value: fCurve.toFixed(5)},
          {label: 'Rel. Rough ε/D', value: relR.toExponential(2)},
        ];
      })()
    : [];

  return (
    <ChartFrame
      title="Moody Friction Factor Chart (Log–Log)"
      subtitle="Darcy–Weisbach friction factor f vs. Reynolds number and relative roughness ε/D"
      finePrintTitle="Moody Diagram Basis"
      finePrintBody={finePrint}
      finePrintDataValues={
        op
          ? [
              {label: 'Reynolds Re', value: op.re.toExponential(2)},
              {label: 'Darcy f', value: op.f.toFixed(5)},
              {label: 'ε/D', value: op.relRoughness.toExponential(3)},
              {label: 'Regime', value: op.regime},
            ]
          : undefined
      }
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-emerald-600" /> Laminar (64/Re)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 bg-amber-100 border border-amber-300" /> Transition (2300–4000)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Colebrook–White (ε/D family)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Pipe Operating Point
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Moody log-log friction factor chart"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* Transitional band */}
        <rect
          x={mapX(2300)}
          y={M.top}
          width={mapX(4000) - mapX(2300)}
          height={H - M.top - M.bottom}
          fill="#FEF3C7"
          opacity={0.75}
        />
        <text
          x={(mapX(2300) + mapX(4000)) / 2}
          y={M.top + 14}
          textAnchor="middle"
          className="fill-amber-800 font-mono text-[9px]"
        >
          Trans.
        </text>

        {/* Log gridlines */}
        {reTicks.map((reVal) => (
          <g key={`re-${reVal}`}>
            <line
              x1={mapX(reVal)}
              y1={M.top}
              x2={mapX(reVal)}
              y2={H - M.bottom}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={mapX(reVal)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[10px]"
            >
              10^{Math.log10(reVal)}
            </text>
          </g>
        ))}

        {fTicks.map((fVal) => (
          <g key={`f-${fVal}`}>
            <line
              x1={M.left}
              y1={mapY(fVal)}
              x2={W - M.right}
              y2={mapY(fVal)}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={mapY(fVal) + 3}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {fVal.toFixed(3)}
            </text>
          </g>
        ))}

        {/* Laminar line */}
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth={2.25}
          points={pointsToPolyline(
            result.laminarCurve.map((p) => ({x: mapX(p.re), y: mapY(p.f)})),
          )}
        />

        {/* Turbulent roughness family */}
        {result.roughnessCurves.map((series) => {
          const pts = series.points.map((p) => ({x: mapX(p.re), y: mapY(p.f)}));
          const last = pts[pts.length - 1];
          const isSmooth = series.relRoughness === 0;
          return (
            <g key={series.label}>
              <polyline
                fill="none"
                stroke={isSmooth ? '#0284C7' : '#2563EB'}
                strokeWidth={isSmooth ? 2 : 1.25}
                opacity={isSmooth ? 1 : 0.75}
                points={pointsToPolyline(pts)}
              />
              {last && (
                <text
                  x={W - M.right + 5}
                  y={last.y + 3}
                  textAnchor="start"
                  className="fill-slate-600 font-mono text-[9px]"
                >
                  {series.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Operating point */}
        {op && (
          <g>
            <line
              x1={mapX(op.re)}
              y1={mapY(op.f)}
              x2={mapX(op.re)}
              y2={H - M.bottom}
              stroke="#E11D48"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={M.left}
              y1={mapY(op.f)}
              x2={mapX(op.re)}
              y2={mapY(op.f)}
              stroke="#E11D48"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={mapX(op.re)}
              cy={mapY(op.f)}
              r={6}
              fill="#E11D48"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            <text
              x={Math.min(W - M.right - 90, mapX(op.re) + 10)}
              y={Math.max(M.top + 16, mapY(op.f) - 10)}
              className="fill-slate-900 font-mono text-[10px] font-semibold"
            >
              {`f = ${op.f.toFixed(4)}`}
            </text>
          </g>
        )}

        {cursor && (
          <g pointerEvents="none">
            <line
              x1={cursor.svgX}
              y1={M.top}
              x2={cursor.svgX}
              y2={H - M.bottom}
              stroke="#64748B"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <line
              x1={M.left}
              y1={cursor.svgY}
              x2={W - M.right}
              y2={cursor.svgY}
              stroke="#64748B"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          </g>
        )}

        <rect
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={H - M.top - M.bottom}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={1}
        />

        <text
          x={(M.left + W - M.right) / 2}
          y={H - 10}
          textAnchor="middle"
          className="fill-slate-700 text-[11px] font-medium"
        >
          Reynolds Number Re (Log Scale)
        </text>
        <text
          x={16}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Darcy Friction Factor f
        </text>
        <text
          x={W - 10}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${W - 10} ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-500 text-[10px] font-medium"
        >
          Relative Roughness ε/D
        </text>
      </svg>
      {cursor && (
        <ChartCursorTooltip
          svgX={cursor.svgX}
          svgY={cursor.svgY}
          viewWidth={W}
          viewHeight={H}
          title="Moody Probe"
          rows={cursorTooltipRows}
        />
      )}
    </ChartFrame>
  );
}

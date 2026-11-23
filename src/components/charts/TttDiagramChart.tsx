import type {TttResult} from '../../engines/tttDiagram';
import {
  ChartCursorTooltip,
  ChartFrame,
  createInverseLinearMapper,
  createInverseLogMapper,
  createLinearMapper,
  createLogMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface TttDiagramChartProps {
  result: TttResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 28, bottom: 48, left: 60};

export function TttDiagramChart({result, finePrint}: TttDiagramChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const mapX = createLogMapper(0.1, 100000, M.left, W - M.right);
  const mapY = createLinearMapper(0, 900, H - M.bottom, M.top);
  const invX = createInverseLogMapper(0.1, 100000, M.left, W - M.right);
  const invY = createInverseLinearMapper(0, 900, H - M.bottom, M.top);

  const readout = cursor
    ? `t: ${invX(cursor.svgX).toFixed(1)} s · T: ${invY(cursor.svgY).toFixed(0)} °C`
    : `${result.grade.name} · Nose ${result.grade.noseTimeS}s @ ${result.grade.noseTempC}°C`;

  const tTicks = [0.1, 1, 10, 100, 1000, 10000, 100000];
  const tempTicks = [100, 200, 300, 400, 500, 600, 700, 800];

  const {grade, startCurve, finishCurve, pathPoints} = result;

  const cursorTooltipRows = cursor
    ? (() => {
        const tVal = invX(cursor.svgX);
        const tempVal = invY(cursor.svgY);
        const tFormatted = tVal >= 100 ? tVal.toFixed(0) : tVal >= 10 ? tVal.toFixed(1) : tVal.toFixed(2);
        return [
          {label: 'Time t', value: `${tFormatted} s`},
          {label: 'Temp T', value: `${tempVal.toFixed(0)} °C`},
          {label: 'Nose', value: `${grade.noseTimeS} s @ ${grade.noseTempC} °C`},
          {label: 'M_s / A₁', value: `${grade.msC} / ${grade.a1C} °C`},
        ];
      })()
    : [];

  return (
    <ChartFrame
      title={`Time–Temperature–Transformation (TTT) Diagram — ${grade.name}`}
      subtitle="Logarithmic transformation C-curves, martensite start/finish, and heat-treatment trajectory"
      finePrintTitle="TTT Transformation Kinetics"
      finePrintBody={finePrint}
      finePrintDataValues={[
        {label: 'Steel Grade', value: grade.name},
        {label: 'Nose', value: `${grade.noseTimeS} s @ ${grade.noseTempC} °C`},
        {label: 'Critical (A₁ / B_s)', value: `${grade.a1C} / ${grade.bsC} °C`},
        {label: 'Martensite (M_s / M₉₀)', value: `${grade.msC} / ${grade.m90C} °C`},
      ]}
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Transformation Start (5%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-cyan-600" /> Transformation Finish (95%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-slate-500" /> A₁ / M_s / M₉₀
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> Cooling / Hold Path
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Time-temperature-transformation TTT steel heat treatment diagram"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <clipPath id="ttt-clip">
            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
          </clipPath>
        </defs>

        {tTicks.map((tv) => (
          <g key={`tv-${tv}`}>
            <line x1={mapX(tv)} y1={M.top} x2={mapX(tv)} y2={H - M.bottom} stroke="#E2E8F0" />
            <text x={mapX(tv)} y={H - M.bottom + 18} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
              {tv < 1 ? tv : tv >= 1000 ? `10^${Math.round(Math.log10(tv))}` : tv}s
            </text>
          </g>
        ))}

        {tempTicks.map((temp) => (
          <g key={`tt-${temp}`}>
            <line x1={M.left} y1={mapY(temp)} x2={W - M.right} y2={mapY(temp)} stroke="#E2E8F0" />
            <text x={M.left - 8} y={mapY(temp) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
              {temp}
            </text>
          </g>
        ))}

        <g clipPath="url(#ttt-clip)">
          {/* A1, Ms, M90 horizontal lines */}
          <line x1={M.left} y1={mapY(grade.a1C)} x2={W - M.right} y2={mapY(grade.a1C)} stroke="#475569" strokeDasharray="5 3" />
          <text x={M.left + 8} y={mapY(grade.a1C) - 5} className="fill-slate-700 font-mono text-[9px] font-semibold">
            A₁ ({grade.a1C}°C) — Stable Austenite Above
          </text>

          <line x1={M.left} y1={mapY(grade.msC)} x2={W - M.right} y2={mapY(grade.msC)} stroke="#7C3AED" strokeDasharray="4 3" />
          <text x={M.left + 8} y={mapY(grade.msC) - 5} className="fill-violet-700 font-mono text-[9px] font-semibold">
            M_s ({grade.msC}°C)
          </text>

          <line x1={M.left} y1={mapY(grade.m90C)} x2={W - M.right} y2={mapY(grade.m90C)} stroke="#7C3AED" strokeDasharray="2 3" opacity={0.7} />
          <text x={M.left + 8} y={mapY(grade.m90C) - 4} className="fill-violet-600 font-mono text-[9px]">
            M₉₀ ({grade.m90C}°C)
          </text>

          {/* Start & finish C-curves */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            points={pointsToPolyline(startCurve.map((p) => ({x: mapX(p.tS), y: mapY(p.tempC)})))}
          />
          <polyline
            fill="none"
            stroke="#0891B2"
            strokeWidth={2.25}
            points={pointsToPolyline(finishCurve.map((p) => ({x: mapX(p.tS), y: mapY(p.tempC)})))}
          />

          {/* Heat-treatment path */}
          {pathPoints.length > 0 && (
            <g>
              <polyline
                fill="none"
                stroke="#E11D48"
                strokeWidth={2.75}
                points={pointsToPolyline(pathPoints.map((p) => ({x: mapX(p.tS), y: mapY(p.tempC)})))}
              />
              {(() => {
                const last = pathPoints[pathPoints.length - 1];
                return (
                  <circle
                    cx={mapX(last.tS)}
                    cy={mapY(last.tempC)}
                    r={5.5}
                    fill="#E11D48"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                );
              })()}
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
          Time (Seconds, Log Scale)
        </text>
        <text
          x={16}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Temperature (°C)
        </text>
      </svg>
      {cursor && (
        <ChartCursorTooltip
          svgX={cursor.svgX}
          svgY={cursor.svgY}
          viewWidth={W}
          viewHeight={H}
          title="TTT Kinetics Probe"
          rows={cursorTooltipRows}
        />
      )}
    </ChartFrame>
  );
}

import type {IronCarbonResult} from '../../engines/ironCarbon';
import {
  ChartFrame,
  createInverseLinearMapper,
  createLinearMapper,
  useSvgCrosshair,
} from './ChartPrimitives';

interface IronCarbonChartProps {
  result: IronCarbonResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 28, bottom: 48, left: 60};

export function IronCarbonChart({result, finePrint}: IronCarbonChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const mapX = createLinearMapper(0, 6.67, M.left, W - M.right);
  const mapY = createLinearMapper(200, 1650, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(0, 6.67, M.left, W - M.right);
  const invY = createInverseLinearMapper(200, 1650, H - M.bottom, M.top);

  const readout = cursor
    ? `C: ${invX(cursor.svgX).toFixed(2)} wt% · T: ${invY(cursor.svgY).toFixed(0)} °C`
    : result.point
      ? `Alloy: ${result.point.c.toFixed(2)}% C at ${result.point.t.toFixed(0)} °C`
      : null;

  const cTicks = [0, 0.76, 2.14, 4.3, 6.67];
  const tTicks = [400, 727, 912, 1147, 1400, 1600];

  const pt = (c: number, t: number) => `${mapX(c).toFixed(1)},${mapY(t).toFixed(1)}`;

  return (
    <ChartFrame
      title="Iron–Carbon (Fe–Fe₃C) Equilibrium Phase Diagram"
      subtitle="Metastable steel and cast iron phase fields with active Lever Rule tie-line"
      finePrintTitle="Fe–Fe₃C Invariant Reactions"
      finePrintBody={finePrint}
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-slate-800" /> Phase Boundaries
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Lever Rule Tie-Line
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Alloy State
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Iron-carbon equilibrium phase diagram"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {cTicks.map((cVal) => (
          <g key={`c-${cVal}`}>
            <line x1={mapX(cVal)} y1={M.top} x2={mapX(cVal)} y2={H - M.bottom} stroke="#E2E8F0" />
            <text x={mapX(cVal)} y={H - M.bottom + 18} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
              {cVal}%
            </text>
          </g>
        ))}

        {tTicks.map((tVal) => (
          <g key={`t-${tVal}`}>
            <line x1={M.left} y1={mapY(tVal)} x2={W - M.right} y2={mapY(tVal)} stroke="#E2E8F0" />
            <text x={M.left - 8} y={mapY(tVal) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
              {tVal}
            </text>
          </g>
        ))}

        {/* Phase boundary fills */}
        {/* Austenite (gamma) field */}
        <polygon
          points={`${pt(0, 912)} ${pt(0.76, 727)} ${pt(2.14, 1147)} ${pt(0.17, 1493)} ${pt(0, 1394)}`}
          fill="#EFF6FF"
          opacity={0.7}
        />
        {/* Liquid field */}
        <polygon
          points={`${pt(0, 1650)} ${pt(6.67, 1650)} ${pt(6.67, 1500)} ${pt(4.3, 1147)} ${pt(0.53, 1493)} ${pt(0, 1538)}`}
          fill="#FEF3C7"
          opacity={0.45}
        />

        {/* Key Fe-Fe3C boundaries */}
        <g stroke="#1E293B" strokeWidth={1.75} fill="none">
          {/* Liquidus */}
          <polyline points={`${pt(0, 1538)} ${pt(0.53, 1493)} ${pt(4.3, 1147)} ${pt(6.67, 1500)}`} />
          {/* Solidus */}
          <polyline points={`${pt(0, 1538)} ${pt(0.17, 1493)} ${pt(2.14, 1147)} ${pt(6.67, 1147)}`} />
          {/* Peritectic */}
          <line x1={mapX(0.09)} y1={mapY(1493)} x2={mapX(0.53)} y2={mapY(1493)} />
          <polyline points={`${pt(0, 1394)} ${pt(0.09, 1493)} ${pt(0.17, 1493)}`} />
          {/* A3 & Acm */}
          <line x1={mapX(0)} y1={mapY(912)} x2={mapX(0.76)} y2={mapY(727)} />
          <line x1={mapX(0.76)} y1={mapY(727)} x2={mapX(2.14)} y2={mapY(1147)} />
          {/* A1 Eutectoid isotherm */}
          <line x1={mapX(0.022)} y1={mapY(727)} x2={mapX(6.67)} y2={mapY(727)} />
          {/* Ferrite solvus */}
          <polyline points={`${pt(0, 912)} ${pt(0.022, 727)} ${pt(0.008, 200)}`} />
        </g>

        {/* Field labels */}
        <text x={mapX(2.8)} y={mapY(1520)} className="fill-amber-900 font-mono text-[11px] font-semibold">
          Liquid (L)
        </text>
        <text x={mapX(0.85)} y={mapY(1040)} className="fill-blue-900 font-mono text-[11px] font-semibold">
          γ-Austenite
        </text>
        <text x={mapX(1.1)} y={mapY(1340)} className="fill-slate-600 font-mono text-[10px]">
          γ + L
        </text>
        <text x={mapX(3.8)} y={mapY(920)} className="fill-slate-700 font-mono text-[10px]">
          γ + Fe₃C
        </text>
        <text x={mapX(2.8)} y={mapY(480)} className="fill-slate-700 font-mono text-[11px]">
          α-Ferrite + Fe₃C (Pearlite + Cementite)
        </text>
        <text x={mapX(0.76)} y={mapY(742)} textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
          0.76% Eutectoid
        </text>
        <text x={mapX(4.3)} y={mapY(1132)} textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
          4.30% Eutectic
        </text>

        {/* Lever rule tie-line */}
        {result.tieLine && (
          <g>
            <line
              x1={mapX(result.tieLine.left.c)}
              y1={mapY(result.tieLine.left.t)}
              x2={mapX(result.tieLine.right.c)}
              y2={mapY(result.tieLine.right.t)}
              stroke="#2563EB"
              strokeWidth={2.5}
            />
            <circle cx={mapX(result.tieLine.left.c)} cy={mapY(result.tieLine.left.t)} r={4} fill="#2563EB" />
            <circle cx={mapX(result.tieLine.right.c)} cy={mapY(result.tieLine.right.t)} r={4} fill="#2563EB" />
          </g>
        )}

        {/* Active alloy point */}
        {result.point && (
          <g>
            <line
              x1={mapX(result.point.c)}
              y1={mapY(result.point.t)}
              x2={mapX(result.point.c)}
              y2={H - M.bottom}
              stroke="#E11D48"
              strokeDasharray="3 3"
            />
            <circle
              cx={mapX(result.point.c)}
              cy={mapY(result.point.t)}
              r={6}
              fill="#E11D48"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            <text
              x={Math.min(W - M.right - 96, mapX(result.point.c) + 10)}
              y={Math.max(M.top + 16, mapY(result.point.t) - 10)}
              className="fill-slate-900 font-mono text-[10px] font-semibold"
            >
              {`${result.point.c.toFixed(2)}% C · ${result.point.t.toFixed(0)}°C`}
            </text>
          </g>
        )}

        {cursor && (
          <g pointerEvents="none">
            <line x1={cursor.svgX} y1={M.top} x2={cursor.svgX} y2={H - M.bottom} stroke="#64748B" strokeDasharray="2 2" />
            <line x1={M.left} y1={cursor.svgY} x2={W - M.right} y2={cursor.svgY} stroke="#64748B" strokeDasharray="2 2" />
          </g>
        )}

        <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="none" stroke="#94A3B8" />
        <text x={(M.left + W - M.right) / 2} y={H - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-medium">
          Carbon Composition (wt% C)
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
    </ChartFrame>
  );
}

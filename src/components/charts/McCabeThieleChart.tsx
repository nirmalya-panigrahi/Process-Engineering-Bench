import type {McCabeThieleResult} from '../../engines/mccabeThiele';
import {
  ChartFrame,
  createInverseLinearMapper,
  createLinearMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface McCabeThieleChartProps {
  result: McCabeThieleResult;
  finePrint: string;
}

const W = 540;
const H = 480;
const M = {top: 24, right: 28, bottom: 48, left: 56};

export function McCabeThieleChart({result, finePrint}: McCabeThieleChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const mapX = createLinearMapper(0, 1, M.left, W - M.right);
  const mapY = createLinearMapper(0, 1, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(0, 1, M.left, W - M.right);
  const invY = createInverseLinearMapper(0, 1, H - M.bottom, M.top);

  const readout = cursor
    ? `x: ${invX(cursor.svgX).toFixed(3)} · y: ${invY(cursor.svgY).toFixed(3)}`
    : result.intersection
      ? `Feed Pinch Int: (${result.intersection.x.toFixed(3)}, ${result.intersection.y.toFixed(3)})`
      : null;

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <ChartFrame
      title="McCabe–Thiele Binary Distillation Diagram"
      subtitle="VLE equilibrium curve, operating lines, q-line, and stepped equilibrium stages"
      finePrintTitle="McCabe–Thiele Construction"
      finePrintBody={finePrint}
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> VLE Curve
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-emerald-600" /> Rectifying / Stripping Lines
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-amber-600" /> Feed q-Line
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> Theoretical Trays
          </span>
        </>
      }
    >
      <div className="mx-auto max-w-[560px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="McCabe-Thiele distillation equilibrium staircase chart"
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={mapX(t)} y1={M.top} x2={mapX(t)} y2={H - M.bottom} stroke="#E2E8F0" />
              <text x={mapX(t)} y={H - M.bottom + 18} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
                {t.toFixed(1)}
              </text>
              <line x1={M.left} y1={mapY(t)} x2={W - M.right} y2={mapY(t)} stroke="#E2E8F0" />
              <text x={M.left - 8} y={mapY(t) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
                {t.toFixed(1)}
              </text>
            </g>
          ))}

          {/* 45-degree diagonal */}
          <line
            x1={mapX(0)}
            y1={mapY(0)}
            x2={mapX(1)}
            y2={mapY(1)}
            stroke="#94A3B8"
            strokeWidth={1.25}
          />

          {/* VLE Equilibrium curve */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            points={pointsToPolyline(result.vleCurve.map((p) => ({x: mapX(p.x), y: mapY(p.y)})))}
          />

          {/* q-Line */}
          {result.qLine.length === 2 && (
            <line
              x1={mapX(result.qLine[0].x)}
              y1={mapY(result.qLine[0].y)}
              x2={mapX(result.qLine[1].x)}
              y2={mapY(result.qLine[1].y)}
              stroke="#D97706"
              strokeWidth={1.75}
              strokeDasharray="4 3"
            />
          )}

          {/* Rectifying & Stripping operating lines */}
          {result.rectifyingLine.length === 2 && (
            <line
              x1={mapX(result.rectifyingLine[0].x)}
              y1={mapY(result.rectifyingLine[0].y)}
              x2={mapX(result.rectifyingLine[1].x)}
              y2={mapY(result.rectifyingLine[1].y)}
              stroke="#059669"
              strokeWidth={2}
            />
          )}
          {result.strippingLine.length === 2 && (
            <line
              x1={mapX(result.strippingLine[0].x)}
              y1={mapY(result.strippingLine[0].y)}
              x2={mapX(result.strippingLine[1].x)}
              y2={mapY(result.strippingLine[1].y)}
              stroke="#0D9488"
              strokeWidth={2}
            />
          )}

          {/* Stepped staircase */}
          {result.stages.map((st) => {
            const strokeColor = st.section === 'rectifying' ? '#E11D48' : '#EA580C';
            return (
              <g key={st.stageNumber}>
                <line
                  x1={mapX(st.horizontal[0].x)}
                  y1={mapY(st.horizontal[0].y)}
                  x2={mapX(st.horizontal[1].x)}
                  y2={mapY(st.horizontal[1].y)}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                />
                <line
                  x1={mapX(st.vertical[0].x)}
                  y1={mapY(st.vertical[0].y)}
                  x2={mapX(st.vertical[1].x)}
                  y2={mapY(st.vertical[1].y)}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                />
                {st.stageNumber <= 12 && (
                  <text
                    x={mapX(st.horizontal[1].x) - 10}
                    y={mapY(st.horizontal[1].y) - 3}
                    className="fill-slate-700 font-mono text-[9px]"
                  >
                    {st.stageNumber}
                  </text>
                )}
              </g>
            );
          })}

          {result.intersection && (
            <circle
              cx={mapX(result.intersection.x)}
              cy={mapY(result.intersection.y)}
              r={4.5}
              fill="#D97706"
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          )}

          {cursor && (
            <g pointerEvents="none">
              <line x1={cursor.svgX} y1={M.top} x2={cursor.svgX} y2={H - M.bottom} stroke="#64748B" strokeDasharray="2 2" />
              <line x1={M.left} y1={cursor.svgY} x2={W - M.right} y2={cursor.svgY} stroke="#64748B" strokeDasharray="2 2" />
            </g>
          )}

          <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="none" stroke="#94A3B8" />
          <text x={(M.left + W - M.right) / 2} y={H - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-medium">
            Liquid Mole Fraction x (Light Key)
          </text>
          <text
            x={16}
            y={(M.top + H - M.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
            className="fill-slate-700 text-[11px] font-medium"
          >
            Vapor Mole Fraction y (Light Key)
          </text>
        </svg>
      </div>
    </ChartFrame>
  );
}

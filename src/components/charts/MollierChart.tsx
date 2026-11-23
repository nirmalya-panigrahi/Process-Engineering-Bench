import type {MollierResult} from '../../engines/mollier';
import {
  ChartCursorTooltip,
  ChartFrame,
  createInverseLinearMapper,
  createLinearMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface MollierChartProps {
  result: MollierResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 28, bottom: 48, left: 60};

export function MollierChart({result, finePrint}: MollierChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const sMin = 3.5;
  const sMax = 9.5;
  const hMin = 1500;
  const hMax = 3800;

  const mapX = createLinearMapper(sMin, sMax, M.left, W - M.right);
  const mapY = createLinearMapper(hMin, hMax, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(sMin, sMax, M.left, W - M.right);
  const invY = createInverseLinearMapper(hMin, hMax, H - M.bottom, M.top);

  const st = result.states;
  const readout = cursor
    ? `s: ${invX(cursor.svgX).toFixed(2)} kJ/kg·K · h: ${invY(cursor.svgY).toFixed(0)} kJ/kg`
    : st
      ? `h₁: ${st.h1.toFixed(0)} → h₂: ${st.h2.toFixed(0)} kJ/kg`
      : null;

  const sTicks = [4, 5, 6, 7, 8, 9];
  const hTicks = [1600, 2000, 2400, 2800, 3200, 3600];

  const cursorTooltipRows = cursor
    ? [
        {label: 'Entropy s', value: `${invX(cursor.svgX).toFixed(3)} kJ/kg·K`},
        {label: 'Enthalpy h', value: `${invY(cursor.svgY).toFixed(1)} kJ/kg`},
        ...(st
          ? [
              {label: 'Inlet (s₁, h₁)', value: `${st.s1.toFixed(2)}, ${st.h1.toFixed(0)}`},
              {label: 'Actual (s₂, h₂)', value: `${st.s2.toFixed(2)}, ${st.h2.toFixed(0)}`},
            ]
          : []),
      ]
    : [];

  return (
    <ChartFrame
      title="Mollier Diagram (h–s Steam Expansion)"
      subtitle="Specific enthalpy vs. specific entropy across saturation dome and turbine expansion path"
      finePrintTitle="Mollier Expansion Geometry"
      finePrintBody={finePrint}
      finePrintDataValues={
        st
          ? [
              {label: 'Inlet h₁ / s₁', value: `${st.h1.toFixed(1)} kJ/kg · ${st.s1.toFixed(3)}`},
              {label: 'Isentropic h₂s', value: `${st.h2s.toFixed(1)} kJ/kg`},
              {label: 'Actual h₂', value: `${st.h2.toFixed(1)} kJ/kg`},
              {
                label: 'Exhaust x₂',
                value: st.x2 !== null ? `${(st.x2 * 100).toFixed(2)}%` : `${st.t2C.toFixed(1)} °C`,
              },
            ]
          : undefined
      }
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Saturated Vapor Line
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-cyan-600" /> Constant Quality (x)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-slate-500" /> Isentropic (1→2s)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> Actual Expansion (1→2)
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Mollier enthalpy-entropy steam chart"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <clipPath id="mollier-clip">
            <rect
              x={M.left}
              y={M.top}
              width={W - M.left - M.right}
              height={H - M.top - M.bottom}
            />
          </clipPath>
        </defs>

        {sTicks.map((sVal) => (
          <g key={`s-${sVal}`}>
            <line
              x1={mapX(sVal)}
              y1={M.top}
              x2={mapX(sVal)}
              y2={H - M.bottom}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={mapX(sVal)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {sVal.toFixed(1)}
            </text>
          </g>
        ))}

        {hTicks.map((hVal) => (
          <g key={`h-${hVal}`}>
            <line
              x1={M.left}
              y1={mapY(hVal)}
              x2={W - M.right}
              y2={mapY(hVal)}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={mapY(hVal) + 3}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {hVal}
            </text>
          </g>
        ))}

        <g clipPath="url(#mollier-clip)">
          {/* Isobars */}
          {result.dome.isobars.map((iso) => {
            const pts = iso.points.map((p) => ({x: mapX(p.s), y: mapY(p.h)}));
            const last = pts[pts.length - 1];
            return (
              <g key={iso.label}>
                <polyline
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={1}
                  opacity={0.65}
                  points={pointsToPolyline(pts)}
                />
                {last && (
                  <text
                    x={Math.min(W - M.right - 34, last.x + 4)}
                    y={Math.max(M.top + 12, last.y)}
                    className="fill-slate-500 font-mono text-[9px]"
                  >
                    {iso.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Constant quality lines */}
          {result.dome.qualityLines.map((ql) => {
            const pts = ql.points.map((p) => ({x: mapX(p.s), y: mapY(p.h)}));
            const first = pts[0];
            return (
              <g key={ql.label}>
                <polyline
                  fill="none"
                  stroke="#0891B2"
                  strokeWidth={1.1}
                  strokeDasharray="4 3"
                  opacity={0.7}
                  points={pointsToPolyline(pts)}
                />
                {first && (
                  <text
                    x={Math.max(M.left + 4, first.x - 16)}
                    y={first.y + 12}
                    className="fill-cyan-700 font-mono text-[9px]"
                  >
                    {ql.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Saturation vapor line */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            points={pointsToPolyline(
              result.dome.vaporLine.map((p) => ({x: mapX(p.s), y: mapY(p.h)})),
            )}
          />

          {/* Expansion paths */}
          {st && (
            <g>
              {/* Isentropic 1 -> 2s */}
              <line
                x1={mapX(st.s1)}
                y1={mapY(st.h1)}
                x2={mapX(st.s2s)}
                y2={mapY(st.h2s)}
                stroke="#475569"
                strokeWidth={1.75}
                strokeDasharray="5 3"
              />
              {/* Constant pressure tie between 2s and 2 */}
              <line
                x1={mapX(st.s2s)}
                y1={mapY(st.h2s)}
                x2={mapX(st.s2)}
                y2={mapY(st.h2)}
                stroke="#94A3B8"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              {/* Actual 1 -> 2 */}
              <line
                x1={mapX(st.s1)}
                y1={mapY(st.h1)}
                x2={mapX(st.s2)}
                y2={mapY(st.h2)}
                stroke="#E11D48"
                strokeWidth={2.75}
              />

              <circle cx={mapX(st.s1)} cy={mapY(st.h1)} r={5.5} fill="#0F172A" stroke="#FFF" strokeWidth={2} />
              <text x={mapX(st.s1) + 8} y={mapY(st.h1) - 6} className="fill-slate-900 font-mono text-[10px] font-semibold">
                1 (Inlet)
              </text>

              <circle cx={mapX(st.s2s)} cy={mapY(st.h2s)} r={4.5} fill="#64748B" stroke="#FFF" strokeWidth={1.5} />
              <text x={mapX(st.s2s) - 24} y={mapY(st.h2s) + 14} className="fill-slate-600 font-mono text-[10px]">
                2s
              </text>

              <circle cx={mapX(st.s2)} cy={mapY(st.h2)} r={5.5} fill="#E11D48" stroke="#FFF" strokeWidth={2} />
              <text x={mapX(st.s2) + 8} y={mapY(st.h2) + 4} className="fill-rose-700 font-mono text-[10px] font-semibold">
                2 (Actual)
              </text>
            </g>
          )}
        </g>

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
          Specific Entropy s (kJ/kg·K)
        </text>
        <text
          x={16}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Specific Enthalpy h (kJ/kg)
        </text>
      </svg>
      {cursor && (
        <ChartCursorTooltip
          svgX={cursor.svgX}
          svgY={cursor.svgY}
          viewWidth={W}
          viewHeight={H}
          title="Mollier h–s Probe"
          rows={cursorTooltipRows}
        />
      )}
    </ChartFrame>
  );
}

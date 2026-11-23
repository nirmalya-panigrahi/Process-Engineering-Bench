import type {PhResult} from '../../engines/refrigeration';
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

interface PhRefrigerationChartProps {
  result: PhResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 28, bottom: 48, left: 60};

export function PhRefrigerationChart({result, finePrint}: PhRefrigerationChartProps) {
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const {hMin, hMax, pMin, pMax, liquidLine, vaporLine} = result.dome;
  const mapX = createLinearMapper(hMin, hMax, M.left, W - M.right);
  const mapY = createLogMapper(pMin, pMax, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(hMin, hMax, M.left, W - M.right);
  const invY = createInverseLogMapper(pMin, pMax, H - M.bottom, M.top);

  const readout = cursor
    ? `h: ${invX(cursor.svgX).toFixed(0)} kJ/kg · P: ${invY(cursor.svgY).toFixed(0)} kPa`
    : result.cyclePoints.length === 4
      ? `P_evap: ${result.cyclePoints[0].pKpa.toFixed(0)} kPa → P_cond: ${result.cyclePoints[1].pKpa.toFixed(0)} kPa`
      : null;

  const hStep = Math.round((hMax - hMin) / 5 / 20) * 20 || 50;
  const hTicks: number[] = [];
  for (let hv = Math.ceil(hMin / hStep) * hStep; hv <= hMax; hv += hStep) {
    hTicks.push(hv);
  }

  const pCandidates = [50, 100, 200, 500, 1000, 2000, 4000, 8000];
  const pTicks = pCandidates.filter((p) => p >= pMin * 0.9 && p <= pMax * 1.05);

  const domePolygon = [...liquidLine, ...[...vaporLine].reverse()].map((pt) => ({
    x: mapX(pt.h),
    y: mapY(pt.pKpa),
  }));

  const loop =
    result.cyclePoints.length === 4
      ? [...result.cyclePoints, result.cyclePoints[0]].map((pt) => ({
          x: mapX(pt.h),
          y: mapY(pt.pKpa),
        }))
      : [];

  const cursorTooltipRows = cursor
    ? (() => {
        const hVal = invX(cursor.svgX);
        const pVal = invY(cursor.svgY);
        let nearestLabel: string | null = null;
        let nearestVals: string | null = null;
        let minDist = 28;
        for (const pt of result.cyclePoints) {
          const d = Math.hypot(mapX(pt.h) - cursor.svgX, mapY(pt.pKpa) - cursor.svgY);
          if (d < minDist) {
            minDist = d;
            nearestLabel = pt.label ?? null;
            nearestVals = `${pt.h.toFixed(1)} kJ/kg @ ${pt.pKpa.toFixed(0)} kPa`;
          }
        }
        return [
          {label: 'Enthalpy h', value: `${hVal.toFixed(1)} kJ/kg`},
          {label: 'Pressure P', value: `${pVal.toFixed(0)} kPa`},
          ...(nearestLabel && nearestVals
            ? [{label: `State ${nearestLabel.split(' ')[0]}`, value: nearestVals}]
            : []),
        ];
      })()
    : [];

  return (
    <ChartFrame
      title="Pressure–Enthalpy (P–h) Refrigeration Cycle"
      subtitle="Log-pressure vs. enthalpy saturation dome with 4-state vapor compression loop"
      finePrintTitle="Vapor-Compression P–h Cycle"
      finePrintBody={finePrint}
      finePrintDataValues={
        result.cyclePoints.length === 4
          ? result.cyclePoints.map((pt) => ({
              label: pt.label ?? 'State',
              value: `${pt.h.toFixed(1)} kJ/kg · ${pt.pKpa.toFixed(0)} kPa`,
            }))
          : undefined
      }
      crosshairReadout={readout}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> Saturated Liquid / Vapor Dome
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rose-600" /> Refrigeration Cycle (1→2→3→4→1)
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Pressure-enthalpy refrigeration cycle chart"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <clipPath id="ph-clip">
            <rect
              x={M.left}
              y={M.top}
              width={W - M.left - M.right}
              height={H - M.top - M.bottom}
            />
          </clipPath>
        </defs>

        {hTicks.map((hv) => (
          <g key={`ht-${hv}`}>
            <line
              x1={mapX(hv)}
              y1={M.top}
              x2={mapX(hv)}
              y2={H - M.bottom}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={mapX(hv)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {hv}
            </text>
          </g>
        ))}

        {pTicks.map((pv) => (
          <g key={`pt-${pv}`}>
            <line
              x1={M.left}
              y1={mapY(pv)}
              x2={W - M.right}
              y2={mapY(pv)}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={mapY(pv) + 3}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {pv}
            </text>
          </g>
        ))}

        <g clipPath="url(#ph-clip)">
          <polygon points={pointsToPolyline(domePolygon)} fill="#F1F5F9" opacity={0.75} />
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.25}
            points={pointsToPolyline(domePolygon)}
          />

          {loop.length > 0 && (
            <g>
              <polyline
                fill="none"
                stroke="#E11D48"
                strokeWidth={2.5}
                points={pointsToPolyline(loop)}
              />
              {result.cyclePoints.map((pt, idx) => {
                const cx = mapX(pt.h);
                const cy = mapY(pt.pKpa);
                const dx = idx === 1 || idx === 0 ? 8 : -8;
                const anchor = idx === 1 || idx === 0 ? 'start' : 'end';
                const dy = idx === 1 || idx === 2 ? -8 : 14;
                return (
                  <g key={pt.label}>
                    <circle cx={cx} cy={cy} r={5} fill="#E11D48" stroke="#FFFFFF" strokeWidth={2} />
                    <text
                      x={cx + dx}
                      y={cy + dy}
                      textAnchor={anchor}
                      className="fill-slate-900 font-mono text-[10px] font-semibold"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
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
          Specific Enthalpy h (kJ/kg)
        </text>
        <text
          x={16}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Pressure P (kPa, Log Scale)
        </text>
      </svg>
      {cursor && (
        <ChartCursorTooltip
          svgX={cursor.svgX}
          svgY={cursor.svgY}
          viewWidth={W}
          viewHeight={H}
          title="P–h Diagram Probe"
          rows={cursorTooltipRows}
        />
      )}
    </ChartFrame>
  );
}

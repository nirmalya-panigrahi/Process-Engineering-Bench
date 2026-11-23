import {useState} from 'react';
import {
  moistAirEnthalpyKjKg,
  saturationVaporPressureKpa,
  type PsychroResult,
} from '../../engines/psychrometric';
import {
  ChartCursorTooltip,
  ChartFrame,
  createInverseLinearMapper,
  createLinearMapper,
  pointsToPolyline,
  useSvgCrosshair,
} from './ChartPrimitives';

interface PsychrometricChartProps {
  result: PsychroResult;
  finePrint: string;
}

const W = 720;
const H = 430;
const M = {top: 24, right: 56, bottom: 48, left: 48};

export function PsychrometricChart({result, finePrint}: PsychrometricChartProps) {
  const [showEnthalpy, setShowEnthalpy] = useState(true);
  const {cursor, onMouseMove, onMouseLeave} = useSvgCrosshair(W, H, M);

  const mapX = createLinearMapper(-5, 55, M.left, W - M.right);
  const mapY = createLinearMapper(0, 45, H - M.bottom, M.top);
  const invX = createInverseLinearMapper(-5, 55, M.left, W - M.right);
  const invY = createInverseLinearMapper(0, 45, H - M.bottom, M.top);

  const readout = cursor
    ? `T_db: ${invX(cursor.svgX).toFixed(1)} °C · W: ${invY(cursor.svgY).toFixed(1)} g/kg`
    : result.statePoint
      ? `State: ${result.statePoint.tDb.toFixed(1)} °C · ${result.statePoint.wGkg.toFixed(1)} g/kg`
      : null;

  const satPts = result.curves.saturation.map((p) => ({x: mapX(p.tDb), y: mapY(p.wGkg)}));
  const satAreaPath =
    satPts.length > 0
      ? `M ${satPts[0].x},${H - M.bottom} ` +
        satPts.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L ${satPts[satPts.length - 1].x},${H - M.bottom} Z`
      : '';

  const xTicks = [0, 10, 20, 30, 40, 50];
  const yTicks = [0, 10, 20, 30, 40];

  const sp = result.statePoint;
  const clampedW = sp ? Math.min(45, Math.max(0, sp.wGkg)) : 0;

  const cursorTemp = cursor ? invX(cursor.svgX) : null;
  const cursorW = cursor ? Math.max(0, invY(cursor.svgY)) : null;
  const cursorTooltipRows =
    cursorTemp !== null && cursorW !== null
      ? (() => {
          const wKg = cursorW / 1000;
          const pAtm =
            sp && sp.wKgKg > 0
              ? (sp.vaporPressureKpa * (0.621945 + sp.wKgKg)) / sp.wKgKg
              : 101.325;
          const pv = (wKg * pAtm) / (0.621945 + wKg);
          const pws = saturationVaporPressureKpa(cursorTemp);
          const rh = Math.min(100, Math.max(0, (pv / pws) * 100));
          const h = moistAirEnthalpyKjKg(cursorTemp, wKg);
          return [
            {label: 'Dry-Bulb T_db', value: `${cursorTemp.toFixed(1)} °C`},
            {label: 'Humidity W', value: `${cursorW.toFixed(2)} g/kg`},
            {label: 'Rel. Humidity', value: `${rh.toFixed(1)} %`},
            {label: 'Enthalpy h', value: `${h.toFixed(1)} kJ/kg`},
          ];
        })()
      : [];

  return (
    <ChartFrame
      title="Psychrometric Chart (W vs. T_db)"
      subtitle="Moist air saturation envelope, relative humidity contours, and enthalpy lines"
      finePrintTitle="Psychrometric Chart Geometry"
      finePrintBody={finePrint}
      finePrintDataValues={
        sp
          ? [
              {label: 'Dry-Bulb T_db', value: `${sp.tDb.toFixed(1)} °C`},
              {label: 'Wet-Bulb T_wb', value: `${sp.tWb.toFixed(2)} °C`},
              {label: 'Dew Point T_dp', value: `${sp.tDp.toFixed(2)} °C`},
              {label: 'Humidity W', value: `${sp.wGkg.toFixed(2)} g/kg`},
            ]
          : undefined
      }
      crosshairReadout={readout}
      controls={
        <button
          type="button"
          onClick={() => setShowEnthalpy((v) => !v)}
          className={`min-h-[32px] rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            showEnthalpy
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {showEnthalpy ? 'Hide Enthalpy' : 'Show Enthalpy'}
        </button>
      }
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-blue-600" /> 100% Saturation
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-cyan-600/70" /> RH Contours (20–80%)
          </span>
          {showEnthalpy && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t border-dashed border-amber-600" /> Constant Enthalpy (kJ/kg)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Air State Point
          </span>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Psychrometric chart plotting humidity ratio versus dry-bulb temperature"
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <clipPath id="psychro-clip">
            <rect
              x={M.left}
              y={M.top}
              width={W - M.left - M.right}
              height={H - M.top - M.bottom}
            />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {xTicks.map((t) => (
          <g key={`xt-${t}`}>
            <line
              x1={mapX(t)}
              y1={M.top}
              x2={mapX(t)}
              y2={H - M.bottom}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={mapX(t)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {t}°C
            </text>
          </g>
        ))}

        {yTicks.map((wVal) => (
          <g key={`yt-${wVal}`}>
            <line
              x1={M.left}
              y1={mapY(wVal)}
              x2={W - M.right}
              y2={mapY(wVal)}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={W - M.right + 8}
              y={mapY(wVal) + 3}
              textAnchor="start"
              className="fill-slate-500 font-mono text-[10px]"
            >
              {wVal}
            </text>
          </g>
        ))}

        <g clipPath="url(#psychro-clip)">
          {/* Shaded valid moist air zone */}
          <path d={satAreaPath} fill="#F1F5F9" opacity={0.65} />

          {/* Enthalpy contours */}
          {showEnthalpy &&
            result.curves.enthalpyLines.map((line) => (
              <g key={line.id}>
                <polyline
                  fill="none"
                  stroke="#D97706"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.7}
                  points={pointsToPolyline(
                    line.points.map((p) => ({x: mapX(p.tDb), y: mapY(p.wGkg)})),
                  )}
                />
                {line.points.length > 0 && (
                  <text
                    x={mapX(line.points[0].tDb) - 2}
                    y={mapY(line.points[0].wGkg) - 4}
                    className="fill-amber-700 font-mono text-[9px]"
                  >
                    {line.label}
                  </text>
                )}
              </g>
            ))}

          {/* RH curves */}
          {result.curves.rhLines.map((rh) => (
            <g key={rh.id}>
              <polyline
                fill="none"
                stroke="#0891B2"
                strokeWidth={1.25}
                opacity={0.75}
                points={pointsToPolyline(
                  rh.points.map((p) => ({x: mapX(p.tDb), y: mapY(p.wGkg)})),
                )}
              />
              {rh.points.length > 0 && (
                <text
                  x={W - M.right - 6}
                  y={Math.max(M.top + 12, mapY(rh.points[rh.points.length - 1].wGkg) - 4)}
                  textAnchor="end"
                  className="fill-cyan-700 font-mono text-[9px]"
                >
                  {rh.label}
                </text>
              )}
            </g>
          ))}

          {/* Saturation curve */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            points={pointsToPolyline(satPts)}
          />

          {/* Operating state point & projection lines */}
          {sp && (
            <g>
              {/* Dew point horizontal projection */}
              <line
                x1={mapX(sp.tDp)}
                y1={mapY(clampedW)}
                x2={mapX(sp.tDb)}
                y2={mapY(clampedW)}
                stroke="#0F172A"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Dry bulb vertical projection */}
              <line
                x1={mapX(sp.tDb)}
                y1={mapY(clampedW)}
                x2={mapX(sp.tDb)}
                y2={H - M.bottom}
                stroke="#0F172A"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Dew point marker on saturation curve */}
              <circle
                cx={mapX(sp.tDp)}
                cy={mapY(clampedW)}
                r={3.5}
                fill="#0EA5E9"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              {/* Primary state point */}
              <circle
                cx={mapX(sp.tDb)}
                cy={mapY(clampedW)}
                r={6}
                fill="#E11D48"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <text
                x={Math.min(W - M.right - 72, mapX(sp.tDb) + 10)}
                y={Math.max(M.top + 16, mapY(clampedW) - 10)}
                className="fill-slate-900 font-mono text-[10px] font-semibold"
              >
                {`(${sp.tDb.toFixed(1)}°C, ${sp.wGkg.toFixed(1)} g/kg)`}
              </text>
            </g>
          )}
        </g>

        {/* Crosshair */}
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

        {/* Frame border */}
        <rect
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={H - M.top - M.bottom}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={1}
        />

        {/* Axis labels */}
        <text
          x={(M.left + W - M.right) / 2}
          y={H - 10}
          textAnchor="middle"
          className="fill-slate-700 text-[11px] font-medium"
        >
          Dry-Bulb Temperature T_db (°C)
        </text>
        <text
          x={W - 14}
          y={(M.top + H - M.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${W - 14} ${(M.top + H - M.bottom) / 2})`}
          className="fill-slate-700 text-[11px] font-medium"
        >
          Humidity Ratio W (g/kg_da)
        </text>
      </svg>
      {cursor && (
        <ChartCursorTooltip
          svgX={cursor.svgX}
          svgY={cursor.svgY}
          viewWidth={W}
          viewHeight={H}
          title="Probe Air State"
          rows={cursorTooltipRows}
        />
      )}
    </ChartFrame>
  );
}

import {useCallback, useState} from 'react';
import type {MouseEvent, ReactNode} from 'react';
import {FinePrintTooltip} from '../FinePrintTooltip';
import type {TooltipDataValue} from '../FinePrintTooltip';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function createLinearMapper(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const span = domainMax - domainMin || 1;
  return (val: number) => rangeMin + ((val - domainMin) / span) * (rangeMax - rangeMin);
}

export function createInverseLinearMapper(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const span = rangeMax - rangeMin || 1;
  return (px: number) => domainMin + ((px - rangeMin) / span) * (domainMax - domainMin);
}

export function createLogMapper(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const lMin = Math.log10(Math.max(1e-12, domainMin));
  const lMax = Math.log10(Math.max(1e-12, domainMax));
  const span = lMax - lMin || 1;
  return (val: number) => {
    const lVal = Math.log10(Math.max(1e-12, val));
    return rangeMin + ((lVal - lMin) / span) * (rangeMax - rangeMin);
  };
}

export function createInverseLogMapper(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const lMin = Math.log10(Math.max(1e-12, domainMin));
  const lMax = Math.log10(Math.max(1e-12, domainMax));
  const span = rangeMax - rangeMin || 1;
  return (px: number) => {
    const lVal = lMin + ((px - rangeMin) / span) * (lMax - lMin);
    return Math.pow(10, lVal);
  };
}

export function pointsToPolyline(pts: {x: number; y: number}[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function useSvgCrosshair(
  viewWidth: number,
  viewHeight: number,
  margin: Margin,
) {
  const [cursor, setCursor] = useState<{svgX: number; svgY: number} | null>(null);

  const onMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * viewWidth;
      const svgY = ((e.clientY - rect.top) / rect.height) * viewHeight;
      if (
        svgX >= margin.left &&
        svgX <= viewWidth - margin.right &&
        svgY >= margin.top &&
        svgY <= viewHeight - margin.bottom
      ) {
        setCursor({svgX, svgY});
      } else {
        setCursor(null);
      }
    },
    [viewWidth, viewHeight, margin.left, margin.right, margin.top, margin.bottom],
  );

  const onMouseLeave = useCallback(() => setCursor(null), []);

  return {cursor, onMouseMove, onMouseLeave};
}

interface ChartCursorTooltipProps {
  svgX: number;
  svgY: number;
  viewWidth: number;
  viewHeight: number;
  title?: string;
  rows: TooltipDataValue[];
}

export function ChartCursorTooltip({
  svgX,
  svgY,
  viewWidth,
  viewHeight,
  title,
  rows,
}: ChartCursorTooltipProps) {
  if (rows.length === 0) return null;

  const leftPct = (svgX / viewWidth) * 100;
  const topPct = (svgY / viewHeight) * 100;
  const flipX = svgX > viewWidth * 0.6;
  const flipY = svgY > viewHeight * 0.65;

  const transformParts = [
    flipX ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
    flipY ? 'translateY(calc(-100% - 12px))' : 'translateY(12px)',
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: transformParts.join(' '),
      }}
      className="pointer-events-none absolute z-30 min-w-[170px] max-w-[240px] rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-2 text-left text-[11px] text-slate-100 shadow-md"
    >
      {title && (
        <div className="mb-1 border-b border-slate-700/80 pb-1 font-mono text-[10px] font-semibold text-sky-300">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums"
          >
            <span className="text-slate-400">{row.label}</span>
            <span className="font-semibold text-amber-300">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChartFrameProps {
  title: string;
  subtitle: string;
  finePrintTitle: string;
  finePrintBody: string;
  finePrintDataValues?: TooltipDataValue[];
  crosshairReadout?: string | null;
  controls?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
}

export function ChartFrame({
  title,
  subtitle,
  finePrintTitle,
  finePrintBody,
  finePrintDataValues,
  crosshairReadout,
  controls,
  legend,
  children,
}: ChartFrameProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <FinePrintTooltip
              title={finePrintTitle}
              content={finePrintBody}
              dataValues={finePrintDataValues}
              align="left"
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {crosshairReadout && (
            <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 tabular-nums">
              {crosshairReadout}
            </span>
          )}
          {controls}
        </div>
      </div>

      <div className="mt-3 relative">{children}</div>

      {legend && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-600">
          {legend}
        </div>
      )}
    </div>
  );
}

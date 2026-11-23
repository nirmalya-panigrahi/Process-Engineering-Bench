import {AlertCircle, AlertTriangle, CheckCircle2} from 'lucide-react';
import type {OutputMetric, ValidationIssue} from '../types/bench';
import {FinePrintTooltip} from './FinePrintTooltip';

interface OutputReadoutGridProps {
  valid: boolean;
  outputs: OutputMetric[];
  issues: ValidationIssue[];
}

export function OutputReadoutGrid({
  valid,
  outputs,
  issues,
}: OutputReadoutGridProps) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (!valid || errors.length > 0) {
    return (
      <section
        aria-label="Calculation output error"
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-rose-900">
              Invalid Physical Boundary or Input Range
            </h2>
            <p className="mt-1 text-xs text-rose-800">
              Adjust the highlighted inputs to restore valid thermodynamic or physical bounds:
            </p>
            <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-rose-800">
              {errors.map((err, idx) => (
                <li key={`${err.field}-${idx}`}>{err.message}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Calculated outputs" className="space-y-3">
      {warnings.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            {warnings.map((w, idx) => (
              <p key={`${w.field}-${idx}`}>{w.message}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {outputs.map((metric) => {
          const isNumeric = typeof metric.value === 'number';
          return (
            <div
              key={metric.id}
              className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-500 truncate">
                    {metric.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {metric.symbol}
                  </span>
                </div>
                <FinePrintTooltip
                  title={`${metric.label} (${metric.symbol})`}
                  content={metric.finePrint}
                  dataValues={[
                    {
                      label: 'Computed Value',
                      value: `${metric.formatted}${metric.unit ? ` ${metric.unit}` : ''}`,
                    },
                    ...(typeof metric.value === 'number' && Number.isFinite(metric.value)
                      ? [
                          {
                            label: 'High Precision',
                            value: `${metric.value.toPrecision(6)}${metric.unit ? ` ${metric.unit}` : ''}`,
                          },
                        ]
                      : []),
                    ...(metric.statusLabel ? [{label: 'Status', value: metric.statusLabel}] : []),
                  ]}
                  align="right"
                />
              </div>

              <div className="mt-2.5 flex items-baseline flex-wrap gap-x-1.5">
                <span
                  className={`font-mono font-semibold text-slate-900 tabular-nums ${
                    isNumeric ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                  }`}
                >
                  {metric.formatted}
                </span>
                {metric.unit && (
                  <span className="font-mono text-xs text-slate-500">
                    {metric.unit}
                  </span>
                )}
              </div>

              {metric.statusLabel && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
                  {metric.status === 'critical' ? (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" aria-hidden="true" />
                      <span className="text-rose-700">{metric.statusLabel}</span>
                    </>
                  ) : metric.status === 'warning' ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                      <span className="text-amber-700">{metric.statusLabel}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span className="text-emerald-700">{metric.statusLabel}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

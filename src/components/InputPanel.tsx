import {AlertCircle, AlertTriangle, RotateCcw} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {EngineeringModuleMeta, ValidationIssue} from '../types/bench';
import {FinePrintTooltip} from './FinePrintTooltip';

interface InputPanelProps {
  meta: EngineeringModuleMeta;
  inputs: Record<string, number | string>;
  issues: ValidationIssue[];
  onChangeInput: (fieldId: string, value: number | string) => void;
  onApplyPreset: (values: Record<string, number | string>) => void;
  onReset: () => void;
}

export function InputPanel({
  meta,
  inputs,
  issues,
  onChangeInput,
  onApplyPreset,
  onReset,
}: InputPanelProps) {
  // Keep raw text drafts so users can clear/type decimals cleanly without cursor jumping
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts({});
  }, [meta.id, inputs]);

  const issueByField = new Map<string, ValidationIssue>();
  for (const issue of issues) {
    if (!issueByField.has(issue.field)) {
      issueByField.set(issue.field, issue);
    }
  }

  return (
    <section
      aria-label="Input parameters"
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Input Parameters</h2>
          <p className="text-xs text-slate-500">Adjust numeric values or load an engineering case</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Presets bar */}
      {meta.presets.length > 0 && (
        <div className="mt-3">
          <label
            htmlFor={`preset-${meta.id}`}
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Reference Case Preset
          </label>
          <select
            id={`preset-${meta.id}`}
            value=""
            onChange={(e) => {
              const found = meta.presets.find((p) => p.id === e.target.value);
              if (found) onApplyPreset(found.values);
            }}
            className="w-full min-h-[40px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="" disabled>
              Load a calibrated preset...
            </option>
            {meta.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Input fields */}
      <div className="mt-4 space-y-4">
        {meta.inputsMeta.map((field) => {
          if (field.visibleWhen && !field.visibleWhen(inputs)) {
            return null;
          }
          const fieldIssue = issueByField.get(field.id);
          const inputId = `input-${meta.id}-${field.id}`;
          const val = inputs[field.id];

          if (field.type === 'select' && field.options) {
            return (
              <div key={field.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={inputId} className="text-xs font-medium text-slate-800">
                    {field.label}
                    <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                      ({field.symbol})
                    </span>
                  </label>
                  <FinePrintTooltip
                    title={`${field.label} (${field.symbol})`}
                    content={field.finePrint}
                    align="right"
                  />
                </div>
                <select
                  id={inputId}
                  value={String(val)}
                  onChange={(e) => onChangeInput(field.id, e.target.value)}
                  className="w-full min-h-[40px] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          const draftVal = drafts[field.id] ?? String(val ?? '');
          const numericVal = Number(val);
          const isError = fieldIssue?.severity === 'error';
          const isWarn = fieldIssue?.severity === 'warning';

          return (
            <div key={field.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-medium text-slate-800">
                  {field.label}
                  <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                    {field.symbol}
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  {field.min !== undefined && field.max !== undefined && (
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {field.min}–{field.max}
                    </span>
                  )}
                  <FinePrintTooltip
                    title={`${field.label} (${field.symbol})`}
                    content={field.finePrint}
                    align="right"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id={inputId}
                    type="number"
                    step={field.step ?? 'any'}
                    value={draftVal}
                    onChange={(e) => {
                      const rawStr = e.target.value;
                      setDrafts((prev) => ({...prev, [field.id]: rawStr}));
                      if (rawStr.trim() === '') {
                        onChangeInput(field.id, Number.NaN);
                      } else {
                        const parsed = Number(rawStr);
                        if (Number.isFinite(parsed)) {
                          onChangeInput(field.id, parsed);
                        }
                      }
                    }}
                    className={`w-full min-h-[40px] rounded-md border bg-white px-3 py-1.5 pr-14 font-mono text-sm font-medium text-slate-900 tabular-nums transition-colors focus:outline-none ${
                      isError
                        ? 'border-rose-500 focus:border-rose-600'
                        : isWarn
                          ? 'border-amber-400 focus:border-amber-500'
                          : 'border-slate-200 focus:border-blue-600'
                    }`}
                  />
                  {field.unit && (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-400">
                      {field.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Fine-resolution range scrubber when bounded and reasonable linear span */}
              {field.min !== undefined &&
                field.max !== undefined &&
                field.id !== 'reynolds' &&
                field.id !== 'holdTimeS' && (
                  <input
                    type="range"
                    aria-label={`${field.label} slider`}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={Number.isFinite(numericVal) ? Math.min(field.max, Math.max(field.min, numericVal)) : field.min}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setDrafts((prev) => {
                        const copy = {...prev};
                        delete copy[field.id];
                        return copy;
                      });
                      onChangeInput(field.id, next);
                    }}
                    className="h-1.5 w-full cursor-pointer accent-blue-600"
                  />
                )}

              {fieldIssue && (
                <p
                  role={isError ? 'alert' : 'status'}
                  className={`flex items-start gap-1.5 text-[11px] leading-snug ${
                    isError ? 'text-rose-700' : 'text-amber-700'
                  }`}
                >
                  {isError ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span>{fieldIssue.message}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

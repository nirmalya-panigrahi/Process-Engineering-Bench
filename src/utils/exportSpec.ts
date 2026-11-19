import type {EngineeringModuleMeta, OutputMetric} from '../types/bench';

export function buildCsvReport(
  meta: EngineeringModuleMeta,
  inputs: Record<string, number | string>,
  outputs: OutputMetric[],
): string {
  const lines: string[] = [
    `Module,"${meta.title}"`,
    `Reference,"${meta.standardRef}"`,
    '',
    'Section,Parameter,Symbol,Value,Unit',
  ];

  for (const field of meta.inputsMeta) {
    if (field.visibleWhen && !field.visibleWhen(inputs)) continue;
    lines.push(
      `Input,"${field.label}","${field.symbol}","${inputs[field.id] ?? ''}","${field.unit}"`,
    );
  }

  for (const out of outputs) {
    lines.push(
      `Output,"${out.label}","${out.symbol}","${out.formatted}","${out.unit}"`,
    );
  }

  return lines.join('\n');
}

export function triggerCsvDownload(
  meta: EngineeringModuleMeta,
  inputs: Record<string, number | string>,
  outputs: OutputMetric[],
): void {
  const csv = buildCsvReport(meta, inputs, outputs);
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `thermochem-${meta.id}-spec.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

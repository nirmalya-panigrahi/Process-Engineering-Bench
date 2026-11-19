export type CategoryId =
  | 'all'
  | 'thermodynamics'
  | 'fluids'
  | 'separations'
  | 'metallurgy';

export type ModuleId =
  | 'psychrometric'
  | 'moody'
  | 'mollier'
  | 'ph-refrigeration'
  | 'ts-pv-cycles'
  | 'mccabe-thiele'
  | 'ternary-phase'
  | 'iron-carbon'
  | 'ttt-diagram'
  | 'pump-head';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface OutputMetric {
  id: string;
  label: string;
  symbol: string;
  value: number | string | null;
  formatted: string;
  unit: string;
  finePrint: string;
  status?: 'nominal' | 'warning' | 'critical';
  statusLabel?: string;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface InputFieldMeta {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: FieldOption[];
  finePrint: string;
  visibleWhen?: (inputs: Record<string, number | string>) => boolean;
}

export interface PresetCase {
  id: string;
  name: string;
  note: string;
  values: Record<string, number | string>;
}

export interface EngineeringModuleMeta {
  id: ModuleId;
  index: string;
  title: string;
  shortTitle: string;
  category: Exclude<CategoryId, 'all'>;
  categoryLabel: string;
  description: string;
  standardRef: string;
  chartFinePrint: string;
  inputsMeta: InputFieldMeta[];
  defaultInputs: Record<string, number | string>;
  presets: PresetCase[];
}

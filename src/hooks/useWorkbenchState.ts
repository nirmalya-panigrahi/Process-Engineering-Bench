import {useCallback, useMemo, useState} from 'react';
import {MODULE_MAP, MODULES_CATALOG} from '../data/modulesMeta';
import {
  calculateIronCarbon,
  calculateMcCabeThiele,
  calculateMollier,
  calculateMoody,
  calculatePhRefrigeration,
  calculatePowerCycle,
  calculatePsychrometric,
  calculatePumpHead,
  calculateTernaryPhase,
  calculateTtt,
} from '../engines';
import type {CategoryId, ModuleId, OutputMetric, ValidationIssue} from '../types/bench';

export type ModuleInputsMap = Record<ModuleId, Record<string, number | string>>;

function buildInitialInputs(): ModuleInputsMap {
  const map = {} as ModuleInputsMap;
  for (const mod of MODULES_CATALOG) {
    map[mod.id] = {...mod.defaultInputs};
  }
  return map;
}

export function evaluateModule(moduleId: ModuleId, inputs: Record<string, number | string>) {
  switch (moduleId) {
    case 'psychrometric':
      return calculatePsychrometric(inputs);
    case 'moody':
      return calculateMoody(inputs);
    case 'mollier':
      return calculateMollier(inputs);
    case 'ph-refrigeration':
      return calculatePhRefrigeration(inputs);
    case 'ts-pv-cycles':
      return calculatePowerCycle(inputs);
    case 'mccabe-thiele':
      return calculateMcCabeThiele(inputs);
    case 'ternary-phase':
      return calculateTernaryPhase(inputs);
    case 'iron-carbon':
      return calculateIronCarbon(inputs);
    case 'ttt-diagram':
      return calculateTtt(inputs);
    case 'pump-head':
      return calculatePumpHead(inputs);
  }
}

export function useWorkbenchState(initialModule: ModuleId = 'psychrometric') {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>(initialModule);
  const [inputsByModule, setInputsByModule] = useState<ModuleInputsMap>(buildInitialInputs);

  const visibleModules = useMemo(() => {
    if (activeCategory === 'all') return MODULES_CATALOG;
    return MODULES_CATALOG.filter((m) => m.category === activeCategory);
  }, [activeCategory]);

  const selectCategory = useCallback((cat: CategoryId) => {
    setActiveCategory(cat);
    if (cat !== 'all') {
      const currentMeta = MODULE_MAP[activeModuleId];
      if (currentMeta.category !== cat) {
        const firstInCat = MODULES_CATALOG.find((m) => m.category === cat);
        if (firstInCat) setActiveModuleId(firstInCat.id);
      }
    }
  }, [activeModuleId]);

  const activeMeta = MODULE_MAP[activeModuleId];
  const activeInputs = inputsByModule[activeModuleId];

  const updateInput = useCallback(
    (fieldId: string, value: number | string) => {
      setInputsByModule((prev) => ({
        ...prev,
        [activeModuleId]: {
          ...prev[activeModuleId],
          [fieldId]: value,
        },
      }));
    },
    [activeModuleId],
  );

  const applyPreset = useCallback(
    (values: Record<string, number | string>) => {
      setInputsByModule((prev) => ({
        ...prev,
        [activeModuleId]: {...values},
      }));
    },
    [activeModuleId],
  );

  const resetActiveModule = useCallback(() => {
    setInputsByModule((prev) => ({
      ...prev,
      [activeModuleId]: {...MODULE_MAP[activeModuleId].defaultInputs},
    }));
  }, [activeModuleId]);

  const evaluation = useMemo(
    () => evaluateModule(activeModuleId, activeInputs),
    [activeModuleId, activeInputs],
  );

  return {
    activeCategory,
    selectCategory,
    activeModuleId,
    setActiveModuleId,
    visibleModules,
    activeMeta,
    activeInputs,
    updateInput,
    applyPreset,
    resetActiveModule,
    evaluation,
    issues: evaluation.issues as ValidationIssue[],
    outputs: evaluation.outputs as OutputMetric[],
  };
}

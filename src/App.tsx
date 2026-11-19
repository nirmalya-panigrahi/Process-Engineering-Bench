import {FinePrintTooltip} from './components/FinePrintTooltip';
import {HeaderBar} from './components/HeaderBar';
import {InputPanel} from './components/InputPanel';
import {ModuleSelector} from './components/ModuleSelector';
import {OutputReadoutGrid} from './components/OutputReadoutGrid';
import {ActiveChart} from './components/charts/ActiveChart';
import {useWorkbenchState} from './hooks/useWorkbenchState';
import {triggerCsvDownload} from './utils/exportSpec';

export default function App() {
  const {
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
    issues,
    outputs,
  } = useWorkbenchState('psychrometric');

  const handleExport = () => {
    if (!evaluation.valid) return;
    triggerCsvDownload(activeMeta, activeInputs, outputs);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <HeaderBar
        activeCategory={activeCategory}
        onSelectCategory={selectCategory}
        onExportCsv={handleExport}
        canExport={evaluation.valid}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <ModuleSelector
            modules={visibleModules}
            activeModuleId={activeModuleId}
            onSelectModule={setActiveModuleId}
          />

          <div className="min-w-0 flex-1 space-y-5">
            {/* Module Title & Reference Header */}
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-600">
                  Module {activeMeta.index}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeMeta.categoryLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">{activeMeta.standardRef}</span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  {activeMeta.title}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Methodology &amp; Fine Print</span>
                  <FinePrintTooltip
                    title={`${activeMeta.title} — Governing Basis`}
                    content={activeMeta.chartFinePrint}
                    align="right"
                  />
                </div>
              </div>

              <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                {activeMeta.description}
              </p>
            </div>

            {/* Primary Engineering Bench Split: Inputs vs Outputs + Diagram */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
              <div className="xl:col-span-4">
                <InputPanel
                  meta={activeMeta}
                  inputs={activeInputs}
                  issues={issues}
                  onChangeInput={updateInput}
                  onApplyPreset={applyPreset}
                  onReset={resetActiveModule}
                />
              </div>

              <div className="xl:col-span-8 space-y-5">
                <OutputReadoutGrid
                  valid={evaluation.valid}
                  outputs={outputs}
                  issues={issues}
                />

                <ActiveChart
                  moduleId={activeModuleId}
                  evaluation={evaluation}
                  finePrint={activeMeta.chartFinePrint}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:px-6">
          <span>ThermoChem Bench — Mechanical &amp; Chemical Engineering Calculation Suite</span>
          <span>Hover or tap any info icon for equation basis and validity bounds.</span>
        </div>
      </footer>
    </div>
  );
}

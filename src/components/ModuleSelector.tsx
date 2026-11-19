import type {EngineeringModuleMeta, ModuleId} from '../types/bench';

interface ModuleSelectorProps {
  modules: EngineeringModuleMeta[];
  activeModuleId: ModuleId;
  onSelectModule: (id: ModuleId) => void;
}

export function ModuleSelector({
  modules,
  activeModuleId,
  onSelectModule,
}: ModuleSelectorProps) {
  return (
    <aside aria-label="Calculation modules" className="w-full lg:w-64 lg:shrink-0">
      {/* Mobile / Tablet horizontal scroll tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 lg:hidden">
        {modules.map((mod) => {
          const active = mod.id === activeModuleId;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="font-mono opacity-75 mr-1.5">{mod.index}.</span>
              {mod.shortTitle}
            </button>
          );
        })}
      </div>

      {/* Desktop vertical module index */}
      <div className="hidden lg:block rounded-lg border border-slate-200 bg-white p-2">
        <div className="px-2.5 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">
          Engineering Diagrams ({modules.length})
        </div>
        <ul className="mt-1 space-y-0.5">
          {modules.map((mod) => {
            const active = mod.id === activeModuleId;
            return (
              <li key={mod.id}>
                <button
                  type="button"
                  onClick={() => onSelectModule(mod.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`font-mono text-xs pt-0.5 tabular-nums shrink-0 ${
                      active ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    {mod.index}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-snug truncate">
                      {mod.title}
                    </span>
                    <span
                      className={`block text-[11px] leading-tight truncate mt-0.5 ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {mod.categoryLabel}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

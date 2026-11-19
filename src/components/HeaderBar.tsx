import {Download} from 'lucide-react';
import type {CategoryId} from '../types/bench';

interface HeaderBarProps {
  activeCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  onExportCsv: () => void;
  canExport: boolean;
}

const NAV_CATEGORIES: {id: CategoryId; label: string}[] = [
  {id: 'all', label: 'All Modules'},
  {id: 'thermodynamics', label: 'Thermodynamics'},
  {id: 'fluids', label: 'Fluid Systems'},
  {id: 'separations', label: 'Separations'},
  {id: 'metallurgy', label: 'Metallurgy'},
];

export function HeaderBar({
  activeCategory,
  onSelectCategory,
  onExportCsv,
  canExport,
}: HeaderBarProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectCategory('all');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ThermoChem Bench
        </a>

        <nav aria-label="Engineering disciplines" className="hidden md:flex items-center gap-6">
          {NAV_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  active
                    ? 'text-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!canExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Mobile discipline navigation row */}
      <nav
        aria-label="Engineering disciplines mobile"
        className="flex md:hidden items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2"
      >
        {NAV_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

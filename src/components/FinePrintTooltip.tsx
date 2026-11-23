import {Info} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';

export interface TooltipDataValue {
  label: string;
  value: string;
}

interface FinePrintTooltipProps {
  title: string;
  content: string;
  dataValues?: TooltipDataValue[];
  align?: 'left' | 'right' | 'center';
}

export function FinePrintTooltip({
  title,
  content,
  dataValues,
  align = 'center',
}: FinePrintTooltipProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const open = hoverOpen || pinnedOpen;
  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinnedOpen(false);
        setHoverOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedOpen(false);
        setHoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const alignClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        type="button"
        aria-label={`Fine print for ${title}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => {
          if (pinnedOpen) {
            setPinnedOpen(false);
            setHoverOpen(false);
          } else {
            setPinnedOpen(true);
          }
        }}
        onFocus={() => setHoverOpen(true)}
        onBlur={() => setHoverOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute bottom-full z-40 mb-2 w-76 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-700 bg-slate-900 p-3 text-left text-xs leading-relaxed text-slate-100 shadow-lg ${alignClasses}`}
        >
          <span className="mb-1.5 block font-mono text-[11px] font-semibold text-sky-300">
            {title}
          </span>

          {dataValues && dataValues.length > 0 && (
            <span className="mb-2 block space-y-1 border-b border-slate-700/80 pb-2">
              {dataValues.map((row) => (
                <span
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums"
                >
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-semibold text-amber-300 text-right">{row.value}</span>
                </span>
              ))}
            </span>
          )}

          <span className="block text-slate-200">{content}</span>
        </span>
      )}
    </span>
  );
}

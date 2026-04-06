import { useRef } from 'react';

interface TimeInput24Props {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
}

/** Time input that always displays and works in 24h format */
export default function TimeInput24({ value, onChange, className = '' }: TimeInput24Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Visible display */}
      <span
        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm cursor-pointer select-none inline-flex items-center gap-1.5 hover:border-primary-400 transition-colors"
        onClick={() => ref.current?.showPicker?.()}
      >
        {value || '--:--'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </span>
      {/* Hidden native time picker */}
      <input
        ref={ref}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        step="60"
      />
    </div>
  );
}

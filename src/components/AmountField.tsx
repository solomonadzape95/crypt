"use client";

import { useId } from "react";
import { motion } from "framer-motion";

type Preset = { value: number; display: string };

type Props = {
  label: string;
  hint?: string;
  presets: Preset[];
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  last?: boolean;
};

/**
 * Amount input combo: preset chips + amber range slider + numeric box.
 * The slider thumb and fill spring smoothly; the numeric box stays the source
 * of truth and accepts free entry.
 */
export function AmountField({
  label,
  hint,
  presets,
  value,
  onChange,
  min,
  max,
  step,
  unit = "USDC",
  last,
}: Props) {
  const id = useId();
  const clamped = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  const pct = ((clamped - min) / (max - min)) * 100;

  return (
    <div
      className={
        "flex flex-col gap-3 px-4 py-4 " +
        (last ? "" : "border-b border-[var(--rule-0)]")
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <span className="label numeric text-[var(--fg-3)]">
          {min}–{max} {unit}
        </span>
      </div>

      {/* Preset chips */}
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => {
          const active = p.value === clamped;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className="relative h-10 border text-sm transition-colors numeric"
              style={{
                borderColor: active ? "var(--amber)" : "var(--rule-0)",
                background: active ? "var(--amber-bg)" : "var(--ink-0)",
                color: active ? "var(--amber)" : "var(--fg-1)",
              }}
            >
              {p.display}
            </button>
          );
        })}
      </div>

      {/* Range + number combo */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-center pt-1">
        <div className="relative h-9 flex items-center">
          {/* track */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[var(--rule-1)]" />
          {/* fill */}
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-[var(--amber)]"
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.4 }}
          />
          {/* tick marks */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
            {Array.from({ length: 11 }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-px bg-[var(--rule-1)]"
                style={{ opacity: i / 10 <= pct / 100 ? 0.6 : 0.25 }}
              />
            ))}
          </div>
          {/* thumb */}
          <motion.div
            className="absolute h-4 w-1 bg-[var(--amber)] -translate-x-1/2 pointer-events-none"
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.4 }}
            style={{ top: "50%", marginTop: "-8px" }}
          />
          {/* native input — invisible, sits on top to capture drag */}
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={clamped}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
          />
        </div>
        <div className="flex items-stretch border border-[var(--rule-0)] focus-within:border-[var(--amber)] transition-colors">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={clamped}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange(n);
            }}
            className="numeric h-9 w-24 bg-[var(--ink-0)] px-3 text-right text-sm
                       focus:outline-none [appearance:textfield]
                       [&::-webkit-outer-spin-button]:appearance-none
                       [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="label px-3 text-[var(--fg-3)] border-l border-[var(--rule-0)] flex items-center">
            {unit}
          </span>
        </div>
      </div>

      {hint && <span className="label text-[var(--fg-3)]">{hint}</span>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IoCheckmark, IoChevronDown } from "react-icons/io5";

export interface Choice<T> {
  value: T;
  label: string;
  count?: number;
}

/**
 * A chip that opens a short list, the chosen one ticked; a click chooses and
 * closes. Tinted while it narrows something (`on`).
 */
export function ChoiceMenu<T>({ label, choices, chosen, onChoose, on, title }: {
  label: string;
  choices: Choice<T>[];
  chosen: T;
  onChoose: (value: T) => void;
  on?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !holder.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="menu" ref={holder}>
      <button type="button" className={`chip${on ? " on" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        <IoChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <ul className="menu-list" role="listbox" aria-label={title}>
          {choices.map((choice) => (
            <li key={String(choice.value)}>
              <button
                type="button"
                role="option"
                aria-selected={choice.value === chosen}
                onClick={() => { onChoose(choice.value); setOpen(false); }}
              >
                <span style={{ width: 18 }}>{choice.value === chosen ? <IoCheckmark className="tick" aria-hidden /> : null}</span>
                {choice.label}
                {choice.count !== undefined ? <span className="count">{choice.count}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Two or three ways of seeing the same thing; the one showing is filled. */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

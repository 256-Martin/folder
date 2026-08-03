'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';

export type SelectOption = { value: string; label: string; group?: string };

/**
 * A listbox that replaces the native <select> on the pages that use it.
 *
 * The native control renders its option list through the operating system —
 * a near full-screen dialog on Android, a bottom wheel on iOS — and no CSS the
 * page provides can reach it. This draws the list itself: a compact panel
 * anchored under the control, in the app's own colours.
 *
 * The value still travels through a hidden input, so server actions and plain
 * GET forms submit exactly as they did with a <select>.
 */
export function Select({
  id,
  name,
  defaultValue = '',
  options,
  placeholder = 'Select…',
  includeEmpty = true,
  required,
  disabled,
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  options: SelectOption[];
  /** Shown when nothing is selected, and as the first, empty choice. */
  placeholder?: string;
  /**
   * Whether the empty choice appears in the list. False where a value is
   * always present — a month picker, say — and "none" is not meaningful.
   */
  includeEmpty?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ term: '', at: 0 });

  /** The placeholder participates in navigation, so it is a real entry. */
  const rows = useMemo<SelectOption[]>(
    () => (includeEmpty ? [{ value: '', label: placeholder }, ...options] : options),
    [includeEmpty, options, placeholder],
  );

  const selectedLabel = rows.find((o) => o.value === value)?.label ?? placeholder;

  const commit = useCallback((next: string) => {
    setValue(next);
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    setActive(Math.max(0, rows.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [disabled, rows, value]);

  // Flip above the control when there is not enough room below it.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - r.bottom < 260 && r.top > window.innerHeight - r.bottom);
  }, [open]);

  // Close on any interaction outside, and keep the active row in view.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(rows[active].value);
        return;
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(rows.length - 1, i + 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case 'Home':
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        e.preventDefault();
        setActive(rows.length - 1);
        return;
      case 'Tab':
        setOpen(false);
        return;
    }

    // Type-ahead: printable keys jump to the next label with that prefix.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.term = now - t.at > 700 ? e.key : t.term + e.key;
      t.at = now;
      const term = t.term.toLowerCase();
      const hit = rows.findIndex((o) => o.label.toLowerCase().startsWith(term));
      if (hit >= 0) setActive(hit);
    }
  };

  const listId = `${id ?? name}-listbox`;
  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <input type="hidden" name={name} value={value} />

      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={clsx('select text-left', !value && 'text-faint')}
      >
        <span className="block truncate">{selectedLabel}</span>
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={id ?? name}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          // Keep focus on the trigger when a row is clicked, without blocking
          // touch scrolling the way a pointerdown handler would.
          onMouseDown={(e) => e.preventDefault()}
          className={clsx(
            'absolute z-50 max-h-64 w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-lg',
            // overscroll-contain stops the page scrolling once the list hits
            // its end; touch-pan-y keeps the gesture a vertical scroll.
            'overscroll-contain touch-pan-y',
            'border border-line bg-surface py-1 shadow-pop',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {rows.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const isSelected = o.value === value;

            return (
              <div key={`${o.group ?? ''}:${o.value}`}>
                {header && (
                  <div className="px-3 pb-0.5 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                    {header}
                  </div>
                )}
                <div
                  data-idx={i}
                  role="option"
                  aria-selected={isSelected}
                  /*
                   * click, not pointerdown: on a touch screen pointerdown fires
                   * the moment a finger lands, before the browser has decided
                   * whether the gesture is a tap or a scroll — so committing
                   * there selected a row and closed the list as soon as the
                   * user tried to scroll it. click fires only for a real tap.
                   */
                  onClick={() => commit(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                    isSelected ? 'font-medium text-brand' : 'text-ink',
                    i === active && 'bg-raised',
                    !o.value && 'text-faint',
                  )}
                >
                  <Icon
                    name="check"
                    size={14}
                    className={clsx('shrink-0', isSelected ? 'text-brand' : 'opacity-0')}
                  />
                  <span className="truncate">{o.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

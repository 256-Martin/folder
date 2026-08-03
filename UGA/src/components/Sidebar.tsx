'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons';
import { visibleNav } from './nav-config';
import type { NavItem } from './nav-config';

/** Width of the icon rail, in px. The tooltip is positioned just clear of it. */
const RAIL = 64;

export function Sidebar({
  role,
  userName,
  envLabel,
}: {
  role: string;
  userName: string;
  envLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = visibleNav(role);

  const isActive = useCallback(
    (href: string) =>
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  // Navigating away always closes the full menu.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar — no rail on small screens, just the drawer. */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden no-print">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost btn-sm"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Icon name="menu" size={18} />
        </button>
        <span className="text-sm font-semibold tracking-tight">UGABRUSH</span>
        <ThemeToggle />
      </div>

      <IconRail groups={groups} isActive={isActive} onOpen={() => setOpen(true)} />

      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/40 no-print"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The full menu. Slides over the rail rather than pushing the page. */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 no-print',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-4">
          <Link href="/" className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-ink">UGABRUSH</div>
            <div className="truncate text-2xs text-muted">Manufacturing System</div>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost btn-sm"
              aria-label="Close menu"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="mb-1.5 flex items-center gap-2 px-2">
                <Icon name={group.icon} size={13} className="text-muted" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
                  {group.label}
                </span>
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        tabIndex={open ? undefined : -1}
                        className={clsx(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition',
                          active
                            ? 'bg-brand/10 font-medium text-brand'
                            : 'text-ink/80 hover:bg-raised hover:text-ink',
                        )}
                      >
                        <Icon
                          name={item.icon}
                          size={15}
                          className={clsx(
                            'shrink-0 transition',
                            active ? 'text-brand' : 'text-muted group-hover:text-ink',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 min-w-0">
            <div className="truncate text-sm font-medium text-ink">{userName}</div>
            <div className="text-2xs text-muted">
              {role}
              {envLabel ? ` · ${envLabel}` : ''}
            </div>
          </div>
          <form action="/api/logout" method="post">
            <button type="submit" tabIndex={open ? undefined : -1} className="btn-secondary btn-sm w-full">
              <Icon name="logout" size={14} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------- rail --- */

function IconRail({
  groups,
  isActive,
  onOpen,
}: {
  groups: ReturnType<typeof visibleNav>;
  isActive: (href: string) => boolean;
  onOpen: () => void;
}) {
  /**
   * 39 icons do not fit on one screen, so the rail scrolls — which would clip a
   * CSS tooltip drawn inside it. The label is therefore rendered once, outside
   * the scroll container, positioned to whichever icon is hovered.
   */
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  const show = (label: string) => (e: React.MouseEvent | React.FocusEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };
  const hide = () => setTip(null);

  return (
    <>
      <aside
        style={{ width: RAIL }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface lg:flex no-print"
      >
        {/* Sits outside the scrolling nav below, so both controls stay put. */}
        <div className="flex flex-col items-center gap-1 border-b border-line py-3">
          <button
            type="button"
            onClick={onOpen}
            className="btn-ghost btn-sm"
            aria-label="Open menu"
            onMouseEnter={show('Menu')}
            onMouseLeave={hide}
            onFocus={show('Menu')}
            onBlur={hide}
          >
            <Icon name="menu" size={18} />
          </button>
          <ThemeToggle onHover={show} onLeave={hide} />
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1" onScroll={hide}>
          {groups.map((group) => (
            <div
              key={group.label}
              className="border-t border-line/60 py-1.5 first:border-t-0"
              role="group"
              aria-label={group.label}
            >
              {group.items.map((item: NavItem) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    onMouseEnter={show(item.label)}
                    onMouseLeave={hide}
                    onFocus={show(item.label)}
                    onBlur={hide}
                    onClick={hide}
                    className={clsx(
                      'mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-lg transition',
                      active
                        ? 'bg-brand/10 text-brand'
                        : 'text-muted hover:bg-raised hover:text-ink',
                    )}
                  >
                    <Icon name={item.icon} size={18} />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {tip && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: RAIL + 8 }}
          className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink shadow-pop lg:block no-print"
        >
          {tip.label}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- theming --- */

function ThemeToggle({
  onHover,
  onLeave,
}: {
  /** Supplied on the rail, where the label shows as a tooltip. */
  onHover?: (label: string) => (e: React.MouseEvent | React.FocusEvent) => void;
  onLeave?: () => void;
} = {}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('ugabrush-theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const label = dark ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      className="btn-ghost btn-sm"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onMouseEnter={onHover?.(label)}
      onMouseLeave={onLeave}
      onFocus={onHover?.(label)}
      onBlur={onLeave}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('ugabrush-theme', next ? 'dark' : 'light');
      }}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={16} />
    </button>
  );
}

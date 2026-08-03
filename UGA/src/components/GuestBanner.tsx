import { Icon } from './icons';

/**
 * Shown on every page when the session came from a share link rather than a
 * sign-in, so it is never ambiguous whose account you are looking at — for the
 * recipient, and for an admin who clicked their own link to test it.
 */
export function GuestBanner({ role }: { role: string }) {
  const readOnly = role === 'VIEW';

  return (
    <div className="border-b border-info/30 bg-info/10 px-4 py-2 no-print sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-ink">
          <Icon name="users" size={15} className="shrink-0 text-info" />
          <span>
            You are viewing this through a <strong>shared link</strong>
            {readOnly ? ' — view only, nothing can be recorded.' : ' — you can record entries.'}
          </span>
        </div>
        <form action="/api/logout" method="post">
          <button type="submit" className="btn-secondary btn-sm">
            Sign in as yourself
          </button>
        </form>
      </div>
    </div>
  );
}

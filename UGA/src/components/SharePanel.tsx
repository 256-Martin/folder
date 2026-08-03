'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './icons';
import { Badge, Card } from './ui';
import type { ActionState } from './RecordForm';
import type { ActiveShare } from '@/lib/sharing';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Working…' : children}
    </button>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost btn-sm text-danger" disabled={pending}>
      {pending ? '…' : 'Revoke'}
    </button>
  );
}

export function SharePanel({
  create,
  revoke,
  links,
}: {
  create: (prev: ActionState, form: FormData) => Promise<ActionState>;
  revoke: (prev: ActionState, form: FormData) => Promise<ActionState>;
  links: ActiveShare[];
}) {
  const [state, createAction] = useActionState(create, null);
  const [, revokeAction] = useActionState(revoke, null);
  const [copied, setCopied] = useState(false);

  // A successful create returns the one and only readable copy of the URL.
  const url = state?.ok && state.message?.startsWith('http') ? state.message : null;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Icon name="users" size={16} className="text-muted" />
        <h2 className="text-sm font-semibold text-ink">Share this system</h2>
      </div>

      <p className="mb-3 text-sm text-muted">
        Creates a link that opens the system without signing in. It does not expire — anyone
        holding it has access <strong className="text-ink">until you revoke it</strong>, including
        anyone they forward it to. Revoking cuts access off immediately, even for someone already
        using it.
      </p>

      <form action={createAction} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[9rem]">
          <span className="mb-1 block text-xs font-medium text-muted">Mode</span>
          <select name="mode" className="select" defaultValue="VIEW">
            <option value="VIEW">View only</option>
            <option value="TEAM">Normal (can record)</option>
          </select>
        </label>
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Who is it for? (optional)</span>
          <input name="label" type="text" className="input" placeholder="e.g. Auditor" />
        </label>
        <Submit>Create link</Submit>
      </form>

      {state && !state.ok && state.message && (
        <p className="mt-3 text-sm text-danger">{state.message}</p>
      )}

      {url && (
        <div className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand">
            <Icon name="check" size={13} />
            Copy this now — it is not shown again
          </div>
          <div className="flex gap-2">
            <input readOnly value={url} className="input flex-1 font-mono text-xs" />
            <button
              type="button"
              className="btn-secondary btn-sm shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(url).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  },
                  () => setCopied(false),
                );
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-2xs text-muted">
            Only a fingerprint of the link is stored, so it cannot be retrieved later. If you lose
            it, revoke it and create another.
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 text-2xs text-warn">
            <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
            <span>
              Do not open this link yourself in this browser — it would sign you out of your admin
              account and sign you in as the guest. To check it works, use a private window
              (Ctrl+Shift+N).
            </span>
          </p>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            Active links
          </div>
          <ul className="divide-y divide-line/70">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={l.mode === 'VIEW' ? 'info' : 'warn'}>
                      {l.mode === 'VIEW' ? 'View only' : 'Normal'}
                    </Badge>
                    {l.label && <span className="text-sm text-ink">{l.label}</span>}
                    <span className="font-mono text-2xs text-faint">{l.tokenHint}…</span>
                    {l.expired && <Badge tone="neutral">Expired</Badge>}
                  </div>
                  <div className="mt-0.5 text-2xs text-muted">
                    {l.expiresAt === null
                      ? 'No expiry'
                      : `${l.expired ? 'Expired' : 'Expires'} ${l.expiresAt.toLocaleString()}`}
                    {' · '}
                    {l.uses === 0 ? 'never opened' : `opened ${l.uses}×`}
                    {l.createdByName ? ` · by ${l.createdByName}` : ''}
                  </div>
                </div>
                <form action={revokeAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <RevokeButton />
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

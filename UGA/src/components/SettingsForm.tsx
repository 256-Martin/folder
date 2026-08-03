'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from './RecordForm';

export type SettingRow = { id: number; key: string; value: string | null; note: string | null };

/** Key/value settings editor — saves every changed row in one submit. */
export function SettingsForm({
  rows,
  table,
  action,
  submitLabel = 'Save settings',
}: {
  rows: SettingRow[];
  table: 'app' | 'meal' | 'report';
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="__table" value={table} />

      {state?.message && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            state.ok ? 'border-ok/40 bg-ok/5 text-ok' : 'border-danger/40 bg-danger/5 text-danger'
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="w-[26%]">Parameter</th>
              <th className="w-[24%]">Value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const toConfirm = String(r.value ?? '').includes('TO CONFIRM');
              return (
                <tr key={r.id}>
                  <td className="align-top font-medium">{r.key}</td>
                  <td className="align-top">
                    <input
                      name={`setting__${r.id}`}
                      defaultValue={r.value ?? ''}
                      className={`input !py-1.5 ${toConfirm ? '!border-warn/60' : ''}`}
                      aria-label={r.key}
                    />
                  </td>
                  <td className="align-top text-xs text-muted">{r.note ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 no-print">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Saving…' : label}
    </button>
  );
}

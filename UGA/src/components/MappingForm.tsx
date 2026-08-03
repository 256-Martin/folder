'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAccountingMapping } from '@/lib/actions/masters';
import type { ActionState } from '@/components/RecordForm';

type Mapping = {
  id: number;
  mappingKey: string;
  debitAccount: string | null;
  creditAccount: string | null;
  notes: string | null;
};

export function MappingForm({ rows }: { rows: Mapping[] }) {
  const [state, formAction] = useActionState(
    saveAccountingMapping as (p: ActionState, f: FormData) => Promise<ActionState>,
    null,
  );

  return (
    <form action={formAction}>
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
              <th className="w-[20%]">Mapping key</th>
              <th className="w-[24%]">Debit account</th>
              <th className="w-[24%]">Credit account</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="align-top font-mono text-xs font-medium">{r.mappingKey}</td>
                <td className="align-top">
                  <input
                    name={`debit__${r.id}`}
                    defaultValue={r.debitAccount ?? ''}
                    className="input !py-1.5"
                    aria-label={`${r.mappingKey} debit account`}
                  />
                </td>
                <td className="align-top">
                  <input
                    name={`credit__${r.id}`}
                    defaultValue={r.creditAccount ?? ''}
                    className="input !py-1.5"
                    aria-label={`${r.mappingKey} credit account`}
                  />
                </td>
                <td className="align-top text-xs text-muted">{r.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 no-print">
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Saving…' : 'Save mappings'}
    </button>
  );
}

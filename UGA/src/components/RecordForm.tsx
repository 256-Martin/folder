'use client';

import clsx from 'clsx';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './icons';

export type Option = { value: string; label: string; group?: string };

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'hidden';
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Column span within the 6-column grid. Defaults to 2. */
  span?: 1 | 2 | 3 | 6;
  defaultValue?: string | number | null;
  step?: string;
  min?: string;
  max?: string;
  readOnly?: boolean;
};

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> } | null;

export function RecordForm({
  action,
  fields,
  submitLabel = 'Save',
  title,
  description,
  collapsible = false,
  defaultOpen = true,
  compact = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FieldDef[];
  submitLabel?: string;
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(defaultOpen);

  if (collapsible && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <Icon name="plus" size={14} />
        {submitLabel}
      </button>
    );
  }

  return (
    <form action={formAction} className="card card-pad no-print">
      {(title || collapsible) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {collapsible && (
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}

      {state && !state.ok && state.message && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.message}
        </div>
      )}
      {state?.ok && state.message && (
        <div className="mb-4 rounded-lg border border-ok/40 bg-ok/5 px-3 py-2 text-sm text-ok">
          {state.message}
        </div>
      )}

      <div className={clsx('grid gap-3', compact ? 'sm:grid-cols-4' : 'sm:grid-cols-6')}>
        {fields.map((f) => (
          <FieldControl key={f.name} field={f} error={state?.errors?.[f.name]} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}

function FieldControl({ field: f, error }: { field: FieldDef; error?: string }) {
  if (f.type === 'hidden') {
    return <input type="hidden" name={f.name} defaultValue={f.defaultValue ?? ''} />;
  }

  const span =
    f.span === 1
      ? 'sm:col-span-1'
      : f.span === 3
        ? 'sm:col-span-3'
        : f.span === 6
          ? 'sm:col-span-6'
          : 'sm:col-span-2';

  const grouped =
    f.options?.some((o) => o.group) ?? false
      ? Object.entries(
          (f.options ?? []).reduce<Record<string, Option[]>>((acc, o) => {
            const key = o.group ?? '';
            (acc[key] ||= []).push(o);
            return acc;
          }, {}),
        )
      : null;

  return (
    <div className={span}>
      {f.type !== 'checkbox' && (
        <label className="label" htmlFor={f.name}>
          {f.label}
          {f.required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}

      {f.type === 'select' ? (
        <select
          id={f.name}
          name={f.name}
          required={f.required}
          defaultValue={f.defaultValue ?? ''}
          disabled={f.readOnly}
          className="select"
        >
          <option value="">Select…</option>
          {grouped
            ? grouped.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))
            : f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea
          id={f.name}
          name={f.name}
          rows={2}
          required={f.required}
          placeholder={f.placeholder}
          defaultValue={f.defaultValue ?? ''}
          readOnly={f.readOnly}
          className="textarea"
        />
      ) : f.type === 'checkbox' ? (
        <label className="mt-6 flex items-center gap-2 text-sm text-ink">
          <input
            id={f.name}
            name={f.name}
            type="checkbox"
            defaultChecked={Boolean(f.defaultValue)}
            className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
          />
          {f.label}
        </label>
      ) : (
        <input
          id={f.name}
          name={f.name}
          type={f.type}
          required={f.required}
          placeholder={f.placeholder}
          defaultValue={f.defaultValue ?? ''}
          step={f.step}
          min={f.min}
          max={f.max}
          readOnly={f.readOnly}
          className="input"
        />
      )}

      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : f.help ? (
        <p className="mt-1 text-xs text-faint">{f.help}</p>
      ) : null}
    </div>
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

/* -------------------------------------------------------------------------- */

/** Small inline form used for row-level actions (void, restore, delete). */
export function InlineAction({
  action,
  label,
  confirm,
  variant = 'ghost',
  fields,
  icon,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  confirm?: string;
  variant?: 'ghost' | 'danger' | 'secondary';
  fields?: Record<string, string | number>;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);

  if (confirm && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx('btn-sm', variant === 'danger' ? 'btn-danger' : 'btn-ghost')}
      >
        {icon && <Icon name={icon} size={13} />}
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {confirm && (
        <input
          name="reason"
          required
          placeholder={confirm}
          className="input !w-44 !py-1 !text-xs"
          autoFocus
        />
      )}
      <button
        type="submit"
        className={clsx('btn-sm', variant === 'danger' ? 'btn-danger' : 'btn-secondary')}
      >
        {label}
      </button>
      {confirm && (
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Cancel
        </button>
      )}
    </form>
  );
}

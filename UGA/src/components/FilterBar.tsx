import { Icon } from './icons';

export type FilterField =
  | { type: 'search'; name: string; label: string; value?: string; placeholder?: string }
  | { type: 'date'; name: string; label: string; value?: string }
  | {
      type: 'select';
      name: string;
      label: string;
      value?: string;
      options: { value: string; label: string }[];
      allLabel?: string;
    };

/**
 * A plain GET form — filtering works without JavaScript and every filtered view
 * is a shareable, bookmarkable URL.
 */
export function FilterBar({
  fields,
  action,
  children,
}: {
  fields: FilterField[];
  action?: string;
  children?: React.ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="card mb-4 flex flex-wrap items-end gap-3 p-3 no-print"
    >
      {fields.map((f) => (
        <div key={f.name} className="min-w-[9rem] flex-1 sm:max-w-[15rem]">
          <label className="label" htmlFor={`filter-${f.name}`}>
            {f.label}
          </label>
          {f.type === 'select' ? (
            <select id={`filter-${f.name}`} name={f.name} defaultValue={f.value ?? ''} className="select">
              <option value="">{f.allLabel ?? 'All'}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`filter-${f.name}`}
              name={f.name}
              type={f.type === 'date' ? 'date' : 'search'}
              defaultValue={f.value ?? ''}
              placeholder={f.type === 'search' ? f.placeholder ?? 'Search…' : undefined}
              className="input"
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-secondary btn-sm">
          <Icon name="search" size={14} />
          Apply
        </button>
        {children}
      </div>
    </form>
  );
}

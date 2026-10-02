'use client';

/**
 * Form primitives for the admin panel.
 *
 * These exist so the product editor stays readable: the alternative is the
 * same `label`/`input`/`mt-1.5`/`inputClass` block repeated forty times, which
 * makes a real layout change a forty-place edit.
 */

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
      </legend>
      {description ? <p className="max-w-prose text-sm text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

export function Row({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

export function Checkbox({
  name,
  label,
  defaultChecked,
  value,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-moss"
      />
      {label}
    </label>
  );
}

/**
 * Facet picker.
 *
 * A multi-checkbox group rather than a multi-select: on a long ingredient list
 * a native multi-select hides the current selection behind a click, which makes
 * "did I tick ceramide?" unanswerable at a glance.
 */
export function FacetPicker({
  legend,
  name,
  options,
  selected,
  emptyNote,
}: {
  legend: string;
  name: string;
  options: { id: string; name: string }[];
  selected: string[];
  emptyNote?: string;
}) {
  if (options.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium">{legend}</p>
        <p className="mt-0.5 text-xs text-muted">{emptyNote ?? 'No terms defined yet.'}</p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <Checkbox
            key={option.id}
            name={name}
            value={option.id}
            label={option.name}
            defaultChecked={selected.includes(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * One item per line.
 *
 * Deliberately not a repeater of inputs: these fields are short marketing
 * strings, and a textarea plus a stated format is a format the business can
 * predict. A repeating row is only worth its complexity when entries need
 * structure beyond a sentence.
 */
export function LineListField({
  label,
  htmlFor,
  hint,
  values,
  placeholder,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  values?: string[];
  placeholder?: string;
}) {
  return (
    <Row label={label} htmlFor={htmlFor} hint={hint ?? 'One per line. Blank lines are ignored.'}>
      <textarea
        id={htmlFor}
        name={htmlFor}
        rows={4}
        defaultValue={(values ?? []).join('\n')}
        placeholder={placeholder}
        className={inputClass}
      />
    </Row>
  );
}

export function SelectField({
  label,
  htmlFor,
  name,
  options,
  defaultValue,
  required,
  hint,
  placeholder,
}: {
  label: string;
  htmlFor: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Row label={label} htmlFor={htmlFor} hint={hint}>
      <select
        id={htmlFor}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        className={inputClass}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

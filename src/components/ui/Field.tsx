'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

/**
 * Form primitives.
 *
 * Every control associates a label programmatically, renders errors through
 * `aria-describedby`, and marks invalid fields with `aria-invalid`. Those
 * three rules are enforced here rather than left to each call site.
 */

const control =
  'w-full rounded-xs border bg-shell px-3.5 text-base text-ink transition-colors duration-200 ' +
  'placeholder:text-muted-light focus:border-ink focus:outline-none focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted';

function fieldClasses(error?: string) {
  return cn(control, error ? 'border-danger' : 'border-line hover:border-line-strong');
}

/* ------------------------------------------------------------------ */
/* Field wrapper                                                       */
/* ------------------------------------------------------------------ */

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, htmlFor, error, hint, optional, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="eyebrow-tight text-ink-soft">
        {label}
        {optional && <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-light">optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-xs leading-relaxed text-danger">
          <Icon name="info" size={13} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  iconLeft?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  optional,
  iconLeft,
  className,
  containerClassName,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      optional={optional}
      className={containerClassName}
    >
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(fieldClasses(error), iconLeft && 'pl-10', 'h-11', className)}
          {...props}
        />
      </div>
    </FieldShell>
  );
}

/** Unlabelled variant for inline use where a group label is present. */
export function TextInput({ className, invalid, ...props }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(fieldClasses(), 'h-11', className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Textarea                                                            */
/* ------------------------------------------------------------------ */

export interface TextareaProps extends ComponentProps<'textarea'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  containerClassName?: string;
}

export function Textarea({
  label,
  error,
  hint,
  optional,
  className,
  containerClassName,
  id,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional} className={containerClassName}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(fieldClasses(error), 'min-h-28 resize-y py-3 leading-relaxed', className)}
        {...props}
      />
    </FieldShell>
  );
}

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export interface SelectProps extends ComponentProps<'select'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  containerClassName?: string;
}

export function Select({
  label,
  error,
  hint,
  optional,
  options,
  className,
  containerClassName,
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional} className={containerClassName}>
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(fieldClasses(error), 'h-11 cursor-pointer appearance-none pr-10', className)}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </FieldShell>
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox & Radio                                                    */
/* ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'size'> {
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

export function Checkbox({ label, count, disabled, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <div className={cn('group relative flex items-center', className)}>
      <input
        type="checkbox"
        id={checkboxId}
        disabled={disabled}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-xs border border-line-strong bg-shell',
          'transition-colors duration-200 checked:border-ink checked:bg-ink',
          "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E\")]",
          'checked:bg-[length:11px_11px] checked:bg-center checked:bg-no-repeat',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        {...props}
      />
      <label
        htmlFor={checkboxId}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-3 py-1.5 pl-3 pr-1 text-sm transition-colors',
          'group-hover:text-ink peer-checked:text-ink peer-disabled:cursor-not-allowed peer-disabled:text-muted',
          disabled && 'opacity-50',
        )}
      >
        <span>{label}</span>
        {count != null && <span className="shrink-0 text-xs tabular-nums text-muted">{count}</span>}
      </label>
    </div>
  );
}

export interface RadioProps extends Omit<ComponentProps<'input'>, 'type' | 'size'> {
  label: ReactNode;
  description?: string;
}

export function Radio({ label, description, className, id, ...props }: RadioProps) {
  const generatedId = useId();
  const radioId = id ?? generatedId;

  return (
    <div className={cn('group flex items-start gap-3', className)}>
      <input
        type="radio"
        id={radioId}
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-shell',
          'transition-colors duration-200 checked:border-ink',
          'checked:shadow-[inset_0_0_0_3.5px_var(--color-shell)]',
          'checked:bg-ink',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        {...props}
      />
      <label htmlFor={radioId} className="cursor-pointer text-sm leading-snug peer-checked:text-ink">
        <span className="block font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
    </div>
  );
}

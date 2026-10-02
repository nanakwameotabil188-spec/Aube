import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

/**
 * Button.
 *
 * One component for every interactive affordance so weight, radius, focus
 * and transition stay identical across the storefront. Renders as `<button>`,
 * a Next `<Link>`, or an `<a>` when the target is external.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'text' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium ' +
  'transition-[background-color,color,border-color,opacity,transform] duration-300 ease-[var(--ease-soft)] ' +
  'disabled:pointer-events-none disabled:opacity-45 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-shell hover:bg-moss-deep',
  secondary: 'border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-shell',
  ghost: 'border border-line bg-shell text-ink hover:border-line-strong hover:bg-sand',
  text: 'text-ink underline-offset-4 hover:underline',
  danger: 'bg-danger text-shell hover:bg-danger/90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-xs px-4 text-xs tracking-[0.1em] uppercase',
  md: 'h-11 rounded-xs px-6 text-sm',
  lg: 'h-14 rounded-xs px-9 text-sm tracking-[0.08em] uppercase',
  icon: 'size-10 rounded-full',
};

const iconSizes: Record<Size, number> = { sm: 14, md: 16, lg: 18, icon: 20 };

interface CommonProps {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = CommonProps & Omit<ComponentProps<'button'>, keyof CommonProps>;
type LinkButtonProps = CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, keyof CommonProps | 'href'>;

function classes({ variant = 'primary', size = 'md', fullWidth, className }: CommonProps) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

export function Button({ variant, size, iconLeft, iconRight, fullWidth, className, children, ...props }: ButtonProps) {
  return (
    <button {...props} className={classes({ variant, size, iconLeft, iconRight, fullWidth, className, children })}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  href,
  ...props
}: LinkButtonProps) {
  const resolved = classes({ variant, size, iconLeft, iconRight, fullWidth, className, children });
  const content = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={resolved} {...props}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={resolved} {...props}>
      {content}
    </Link>
  );
}

/** Convenience: an icon-only control with an accessible label. */
export function IconButton({
  label,
  name,
  size = 'md',
  variant = 'ghost',
  className,
  ...props
}: Omit<ButtonProps, 'children' | 'iconLeft' | 'iconRight'> & { label: string; name: React.ComponentProps<typeof Icon>['name'] }) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} className={className} {...props}>
      <Icon name={name} size={iconSizes[size]} aria-hidden />
    </Button>
  );
}

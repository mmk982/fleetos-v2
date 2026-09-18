import { forwardRef, type ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-[var(--accent)] text-white shadow-xs hover:opacity-90 hover:shadow-md hover:-translate-y-px active:translate-y-0",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-page)] hover:shadow-md hover:-translate-y-px",
  ghost:
    "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]",
  destructive: "bg-[var(--error)] text-white shadow-xs hover:opacity-90",
} as const;

const SIZES = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={`rounded-md font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
});

import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-[var(--accent)] text-white border border-transparent hover:opacity-90",
  secondary:
    "bg-transparent text-[var(--accent)] border border-[1.5px] border-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-page)]",
  destructive:
    "bg-[var(--error)] text-white border border-transparent hover:opacity-90",
} as const;

const SIZES = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={`rounded-none font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

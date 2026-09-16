import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-accent text-primary-fg shadow-glow hover:brightness-110 active:brightness-95",
  accent: "bg-accent text-fg-inverse hover:brightness-110",
  outline:
    "border border-border-strong text-fg hover:border-primary/70 hover:bg-primary/5 hover:text-fg-strong",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg-strong",
  danger: "bg-danger text-white hover:brightness-110",
  subtle:
    "border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-base gap-2",
  lg: "h-12 px-7 text-base gap-2",
  icon: "h-10 w-10 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-btn font-semibold whitespace-nowrap",
        "transition-all duration-200 ease-smooth select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {size !== "icon" && children}
    </button>
  );
});

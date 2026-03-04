import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg-base))] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary-hover))] shadow-sm",
        destructive:
          "bg-[hsl(var(--error))] text-white hover:bg-[hsl(var(--error))]/90 shadow-sm",
        outline:
          "border border-[hsl(var(--border-default))] bg-transparent text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-hover))] hover:border-[hsl(var(--border-strong))]",
        secondary:
          "bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-hover))]",
        ghost: "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]",
        link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline",
        success: "bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90 shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

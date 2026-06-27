import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-[#13b4cf] to-[#0c7689] text-white shadow-[0_4px_14px_rgba(19,180,207,.30)] hover:shadow-[0_6px_20px_rgba(19,180,207,.42)] hover:from-[#2fc8e0] hover:to-[#0c93ac]',
        destructive:
          'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_4px_14px_rgba(220,38,38,.28)] hover:shadow-[0_6px_18px_rgba(220,38,38,.38)]',
        outline:
          'border-2 border-border bg-background hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost:
          'hover:bg-muted hover:text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
        orange:
          'bg-gradient-to-br from-[#F5B942] to-[#D97810] text-white shadow-[0_4px_14px_rgba(232,148,26,.32)] hover:shadow-[0_6px_20px_rgba(232,148,26,.42)] hover:from-[#F9C64F] hover:to-[#E08818]',
        success:
          'bg-gradient-to-br from-[#5DD49F] to-[#35A478] text-white shadow-[0_4px_14px_rgba(77,184,138,.32)] hover:shadow-[0_6px_18px_rgba(77,184,138,.42)]',
      },
      size: {
        default: 'h-9 px-5 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold', className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

// ─── Convenience wrapper ──────────────────────────────────────────────────────

const SIZE_CLS = { xs: 'h-6 w-6', sm: 'h-8 w-8', md: 'h-10 w-10' };
const TEXT_CLS = { xs: 'text-[9px]', sm: 'text-xs', md: 'text-sm' };

interface UserAvatarProps {
  name: string;
  initials: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function UserAvatar({ name, initials, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(SIZE_CLS[size], className)} title={name}>
      <AvatarFallback className={TEXT_CLS[size]}>{initials}</AvatarFallback>
    </Avatar>
  );
}

import { cn } from "@/lib/utils/ui";

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function Spinner({ className, size = 'default' }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent",
        {
          'sm': "h-4 w-4",
          'default': "h-6 w-6",
          'lg': "h-8 w-8",
        }[size],
        className
      )}
    />
  );
}

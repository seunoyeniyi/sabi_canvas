import { cn } from "@sabi-canvas/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-700/60", className)}
      {...props}
    />
  );
}

export { Skeleton };

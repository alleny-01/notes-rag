import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

/** Shadcn/ui Spinner primitive, kept local so it follows the app's icon system. */
export function Spinner({ className = "size-4 animate-[spin_1.35s_linear_infinite] motion-reduce:animate-none", ...props }: ComponentProps<typeof LoaderCircle>) {
  const resolvedClassName = className.replace("animate-spin", "animate-[spin_1.35s_linear_infinite]");
  return <LoaderCircle role="status" aria-label="Loading" className={resolvedClassName} {...props} strokeWidth={1} />;
}
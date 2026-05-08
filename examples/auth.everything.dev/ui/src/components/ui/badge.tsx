import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center border-2 px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none shadow-sm transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default:
          "border-outset border-[rgb(51,51,51)] bg-[rgb(245,245,245)] text-[rgb(51,51,51)] dark:border-[rgb(200,200,200)] dark:bg-[rgb(60,60,60)] dark:text-[rgb(230,230,230)]",
        secondary: "border-outset border-[rgb(180,180,180)] bg-secondary text-secondary-foreground",
        destructive:
          "border-outset border-[rgb(180,50,40)] bg-destructive text-destructive-foreground",
        outline:
          "border-outset border-[rgb(51,51,51)] bg-background text-foreground dark:border-[rgb(200,200,200)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] shadow-sm hover:shadow-md hover:opacity-90 active:border-inset active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground border-2 border-outset border-destructive shadow-sm hover:shadow-md hover:opacity-90 active:border-inset active:shadow-none",
        outline:
          "bg-card text-foreground border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] shadow-sm hover:shadow-md hover:bg-muted active:border-inset active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground border-2 border-outset border-border shadow-sm hover:shadow-md hover:opacity-90 active:border-inset active:shadow-none",
        ghost: "hover:bg-muted hover:text-accent-foreground",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 px-3 py-1.5 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 px-6 py-3 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

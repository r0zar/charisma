import React, { AnchorHTMLAttributes } from "react";
import { cn } from "../utils";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  newTab?: boolean;
  variant?: "default" | "hover" | "nav" | "button";
}

export function Link({
  children,
  className,
  href,
  newTab,
  variant = "default",
  ...props
}: LinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Base styles
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",

        // Variant styles
        variant === "default" && "text-foreground underline decoration-primary decoration-2 underline-offset-4",
        variant === "hover" && "text-foreground hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-4",
        variant === "nav" && "text-muted hover:text-foreground",
        variant === "button" && "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-700",

        className
      )}
      rel={newTab ? "noreferrer noopener" : undefined}
      target={newTab ? "_blank" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

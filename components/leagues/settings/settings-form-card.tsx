import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsFormCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Save / reset actions — rendered in the card footer. */
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared league-settings shell: card with header, body, and footer actions.
 */
export function SettingsFormCard({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
}: SettingsFormCardProps) {
  return (
    <Card size="sm" className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b bg-muted/40 py-3">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-pretty">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={cn("py-4", contentClassName)}>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-end border-t py-3">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

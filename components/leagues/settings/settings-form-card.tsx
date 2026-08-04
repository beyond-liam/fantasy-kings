import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsFormCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Floating / portal actions — rendered outside the card (no footer chrome). */
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared league-settings shell: card with header and body.
 * Actions should use `PageFormActions float={hasChanges}` (floating bar), not a card footer.
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
    <>
      <Card size="sm" className={cn("gap-0 py-0", className)}>
        <CardHeader variant="panel">
          <CardTitle className="text-base text-balance">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-pretty">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className={cn("py-4", contentClassName)}>
          {children}
        </CardContent>
      </Card>
      {footer}
    </>
  );
}

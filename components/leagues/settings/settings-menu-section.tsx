"use client";

import type { ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SettingsMenuItem = {
  label: string;
  icon: IconSvgElement;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
};

/** Shared row styles for settings menu buttons (including draft footer actions). */
export const SETTINGS_MENU_ITEM_CLASS =
  "group/settings-item h-10 min-h-10 w-full justify-start px-2.5 font-normal";

export const SETTINGS_MENU_CHEVRON_CLASS =
  "text-muted-foreground opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/settings-item:translate-x-0.5 group-hover/settings-item:opacity-100";

export function SettingsMenuChevron() {
  return (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      strokeWidth={2}
      data-icon="inline-end"
      className={SETTINGS_MENU_CHEVRON_CLASS}
    />
  );
}

type SettingsMenuSectionProps = {
  title: string;
  items: SettingsMenuItem[];
  variant?: "default" | "danger";
  leading?: ReactNode;
  footer?: ReactNode;
};

export function SettingsMenuSection({
  title,
  items,
  variant = "default",
  leading,
  footer,
}: SettingsMenuSectionProps) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader
        className={cn(
          "border-b py-3 [.border-b]:pb-3",
          variant === "danger" && "bg-destructive/5",
        )}
      >
        <CardTitle
          className={cn(
            "text-balance",
            variant === "danger" && "text-destructive",
          )}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-1.5 px-1.5">
        <TooltipProvider>
          <ul className="flex flex-col gap-0.5">
            {leading ? <li>{leading}</li> : null}
            {items.map((item) => {
              const showDisabledTooltip = Boolean(
                item.disabled && item.disabledReason,
              );
              const isLink = Boolean(item.href && !item.disabled);
              const button = (
                <Button
                  type={isLink ? undefined : "button"}
                  variant="ghost"
                  className={cn(
                    SETTINGS_MENU_ITEM_CLASS,
                    showDisabledTooltip && "w-fit max-w-full",
                  )}
                  disabled={item.disabled}
                  nativeButton={isLink ? false : undefined}
                  render={isLink ? <Link href={item.href!} /> : undefined}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    strokeWidth={1.75}
                    data-icon="inline-start"
                    className={cn(
                      "transition-colors duration-150",
                      variant !== "danger" &&
                        "text-muted-foreground group-hover/settings-item:text-foreground group-hover/button:text-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-pretty">
                    {item.label}
                  </span>
                  {isLink ? <SettingsMenuChevron /> : null}
                </Button>
              );

              if (!showDisabledTooltip) {
                return <li key={item.label}>{button}</li>;
              }

              return (
                <li key={item.label}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex max-w-full cursor-not-allowed" />
                      }
                    >
                      {button}
                    </TooltipTrigger>
                    <TooltipContent align="start" side="top">
                      {item.disabledReason}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
            {footer ? <li>{footer}</li> : null}
          </ul>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

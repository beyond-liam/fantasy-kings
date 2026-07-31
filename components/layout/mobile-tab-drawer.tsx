"use client";

import { useState } from "react";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export type MobileTabDrawerItem = {
  value: string;
  label: string;
  icon: IconSvgElement;
};

type MobileTabDrawerProps = {
  items: readonly MobileTabDrawerItem[];
  value: string;
  onSelect: (value: string) => void;
  /** Accessible name for the drawer, e.g. "League sections". */
  title: string;
  description: string;
  /** Counts keyed by tab value, shown as badges. */
  badges?: Record<string, number | undefined>;
};

function TabBadge({ count }: { count: number }) {
  return (
    <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
      {count}
    </Badge>
  );
}

/** Mobile-only tab switcher: trigger shows the active tab, drawer lists them all. */
export function MobileTabDrawer({
  items,
  value,
  onSelect,
  title,
  description,
  badges,
}: MobileTabDrawerProps) {
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.value === value) ?? items[0];

  if (!active) {
    return null;
  }

  // Surface hidden counts on the trigger so they aren't lost behind the drawer.
  const hiddenCount = badges
    ? items.reduce(
        (total, item) =>
          item.value === value ? total : total + (badges[item.value] ?? 0),
        0,
      )
    : 0;

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-between bg-muted md:hidden"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <HugeiconsIcon
            icon={active.icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          <span className="truncate">{active.label}</span>
          {badges?.[active.value] ? (
            <TabBadge count={badges[active.value] as number} />
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          {hiddenCount > 0 ? <TabBadge count={hiddenCount} /> : null}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </span>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-1 p-4 pt-2">
          {items.map((item) => {
            const isActive = item.value === value;

            return (
              <DrawerClose
                key={item.value}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-11 w-full justify-start gap-2 px-3 font-semibold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                    onClick={() => onSelect(item.value)}
                  />
                }
              >
                <HugeiconsIcon
                  icon={item.icon}
                  strokeWidth={isActive ? 2 : 1.75}
                  data-icon="inline-start"
                />
                <span className="truncate">{item.label}</span>
                {badges?.[item.value] ? (
                  <TabBadge count={badges[item.value] as number} />
                ) : null}
                {isActive ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="ml-auto"
                    data-icon="inline-end"
                  />
                ) : null}
              </DrawerClose>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

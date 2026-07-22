"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type WizardStepFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  isSubmitting?: boolean;
  showBack?: boolean;
};

export function WizardStepFrame({
  title,
  description,
  children,
  onBack,
  onContinue,
  continueLabel = "Next Step",
  continueDisabled,
  isSubmitting,
  showBack = true,
}: WizardStepFrameProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6 duration-300">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="flex items-center justify-end gap-3">
        {showBack && onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Back
          </Button>
        ) : null}
        {onContinue ? (
          <Button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled || isSubmitting}
          >
            {continueLabel === "Create League" ? (
              <HugeiconsIcon
                icon={CheckCheckIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
            ) : null}
            {continueLabel}
            {continueLabel === "Next Step" ? (
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                data-icon="inline-end"
              />
            ) : null}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

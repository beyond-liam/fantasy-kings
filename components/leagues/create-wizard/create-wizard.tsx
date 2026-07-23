"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DraftStep } from "@/components/leagues/create-wizard/draft-step";
import { RosterStep } from "@/components/leagues/create-wizard/roster-step";
import { SetupStep } from "@/components/leagues/create-wizard/setup-step";
import { TransactionsStep } from "@/components/leagues/create-wizard/transactions-step";
import { WizardProgress } from "@/components/leagues/create-wizard/wizard-progress";
import { WizardReview } from "@/components/leagues/create-wizard/wizard-review";
import { WizardStepFrame } from "@/components/leagues/create-wizard/wizard-step-frame";
import { createLeague } from "@/lib/actions/leagues";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRegularSeasonEndWeek } from "@/lib/leagues/season-calendar";
import {
  createLeagueWizardSchema,
  draftStepSchema,
  isWizardStep,
  rosterStepSchema,
  setupStepSchema,
  transactionsStepSchema,
  type CreateLeagueWizardValues,
  type WizardStep,
} from "@/lib/leagues/wizard-schema";
import {
  getInitialWizardValues,
  loadWizardValues,
  saveWizardValues,
} from "@/lib/leagues/wizard-storage";

function flattenErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const fieldErrors = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [
      key,
      messages?.[0] ?? "Invalid value",
    ]),
  );
}

export function CreateLeagueWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step") ?? "setup";
  const currentStep: WizardStep = isWizardStep(stepParam) ? stepParam : "setup";

  const [values, setValues] = useState<CreateLeagueWizardValues>(
    getInitialWizardValues,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is unavailable during SSR; restores saved wizard progress post-hydration.
    setValues(loadWizardValues());
  }, []);

  useEffect(() => {
    saveWizardValues(values);
  }, [values]);

  const goToStep = (step: WizardStep) => {
    router.push(`/leagues/create?step=${step}`);
  };

  const updateValues = (patch: Partial<CreateLeagueWizardValues>) => {
    setValues((current) => {
      const next = { ...current, ...patch };
      if (
        patch.championshipWeek !== undefined ||
        patch.playoffTeamCount !== undefined
      ) {
        next.tradeDeadlineWeek = getRegularSeasonEndWeek(
          next.championshipWeek,
          next.playoffTeamCount,
        );
      }
      return next;
    });
    setErrors({});
  };

  const validateCurrentStep = () => {
    let result;
    switch (currentStep) {
      case "setup":
        result = setupStepSchema.safeParse(values);
        break;
      case "roster":
        result = rosterStepSchema.safeParse(values);
        break;
      case "transactions":
        result = transactionsStepSchema.safeParse(values);
        break;
      case "draft":
        result = draftStepSchema.safeParse(values);
        break;
      default:
        result = createLeagueWizardSchema.safeParse(values);
        break;
    }

    if (!result.success) {
      setErrors(flattenErrors(result.error));
      return false;
    }

    setErrors({});
    return true;
  };

  const handleContinue = () => {
    if (!validateCurrentStep()) {
      return;
    }

    const order: WizardStep[] = [
      "setup",
      "roster",
      "transactions",
      "draft",
      "review",
    ];
    const index = order.indexOf(currentStep);
    if (index < order.length - 1) {
      goToStep(order[index + 1]);
    }
  };

  const handleBack = () => {
    const order: WizardStep[] = [
      "setup",
      "roster",
      "transactions",
      "draft",
      "review",
    ];
    const index = order.indexOf(currentStep);
    if (index > 0) {
      goToStep(order[index - 1]);
    }
  };

  const handleCreate = () => {
    const result = createLeagueWizardSchema.safeParse(values);
    if (!result.success) {
      setErrors(flattenErrors(result.error));
      setSubmitError(null);
      return;
    }

    setSubmitError(null);
    startTransition(async () => {
      const actionResult = await createLeague(result.data);
      if (actionResult?.error) {
        setSubmitError(actionResult.error);
      }
    });
  };

  const tradeWeekOptions = Array.from(
    { length: getRegularSeasonEndWeek(values.championshipWeek, values.playoffTeamCount) },
    (_, i) => i + 1,
  );

  const stepCopy: Record<
    WizardStep,
    { title: string; description: string; continueLabel?: string }
  > = {
    setup: {
      title: "Name your league",
      description: "Set the foundation — teams, divisions, and playoff structure.",
    },
    roster: {
      title: "Build your rosters",
      description: "Choose starters, bench depth, and how points are scored.",
    },
    transactions: {
      title: "Set the rules of engagement",
      description: "Waivers, trades, and when the market closes.",
    },
    draft: {
      title: "Plan your draft night",
      description: "Live room or email draft — pick your pace.",
    },
    review: {
      title: "Review and launch",
      description: "Double-check everything before you invite your league.",
      continueLabel: "Create League",
    },
  };

  const copy = stepCopy[currentStep];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">Create a league</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Let&apos;s get your league ready
        </h1>
        <WizardProgress currentStep={currentStep} />
      </div>

      <WizardStepFrame
        title={copy.title}
        description={copy.description}
        onBack={currentStep === "setup" ? undefined : handleBack}
        onContinue={currentStep === "review" ? handleCreate : handleContinue}
        continueLabel={copy.continueLabel}
        isSubmitting={isPending}
        showBack={currentStep !== "setup"}
      >
        {submitError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Couldn&apos;t create league</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        {currentStep === "setup" ? (
          <SetupStep
            values={values}
            errors={errors}
            onChange={updateValues}
          />
        ) : null}
        {currentStep === "roster" ? (
          <RosterStep
            values={values}
            errors={errors}
            onChange={updateValues}
          />
        ) : null}
        {currentStep === "transactions" ? (
          <TransactionsStep
            values={values}
            errors={errors}
            tradeWeekOptions={tradeWeekOptions}
            onChange={updateValues}
          />
        ) : null}
        {currentStep === "draft" ? (
          <DraftStep values={values} errors={errors} onChange={updateValues} />
        ) : null}
        {currentStep === "review" ? (
          <WizardReview values={values} onEdit={(step) => goToStep(step as WizardStep)} />
        ) : null}
      </WizardStepFrame>
    </div>
  );
}

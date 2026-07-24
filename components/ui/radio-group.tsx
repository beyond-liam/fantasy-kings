"use client"

import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type RadioGroupVariant = NonNullable<
  VariantProps<typeof radioGroupVariants>["variant"]
>

const RadioGroupVariantContext =
  React.createContext<RadioGroupVariant>("default")

const radioGroupVariants = cva("grid w-full gap-3", {
  variants: {
    variant: {
      default: "",
      card: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

const radioGroupItemVariants = cva(
  "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input-border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
  {
    variants: {
      variant: {
        default: "",
        card: "mt-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const radioGroupCardLabelClassName =
  "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left font-normal has-data-checked:border-primary has-data-checked:bg-primary/5 has-disabled:cursor-not-allowed has-disabled:opacity-60 dark:has-data-checked:bg-primary/10"

function RadioGroup({
  className,
  variant = "default",
  ...props
}: RadioGroupPrimitive.Props & VariantProps<typeof radioGroupVariants>) {
  const resolvedVariant = variant ?? "default"

  return (
    <RadioGroupVariantContext.Provider value={resolvedVariant}>
      <RadioGroupPrimitive
        data-slot="radio-group"
        data-variant={resolvedVariant}
        className={cn(radioGroupVariants({ variant: resolvedVariant }), className)}
        {...props}
      />
    </RadioGroupVariantContext.Provider>
  )
}

function RadioGroupItem({
  className,
  children,
  variant: variantProp,
  ...props
}: Omit<RadioPrimitive.Root.Props, "className" | "children"> &
  VariantProps<typeof radioGroupItemVariants> & {
    className?: string
    children?: React.ReactNode
  }) {
  const groupVariant = React.useContext(RadioGroupVariantContext)
  const variant = variantProp ?? groupVariant

  const control = (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        radioGroupItemVariants({ variant }),
        variant === "card" ? undefined : className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center"
      >
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )

  if (variant === "card") {
    return (
      <Label
        data-slot="radio-group-card"
        className={cn(radioGroupCardLabelClassName, className)}
      >
        {control}
        {children != null ? (
          <span className="grid min-w-0 flex-1 gap-1 leading-snug">
            {children}
          </span>
        ) : null}
      </Label>
    )
  }

  return control
}

export { RadioGroup, RadioGroupItem }

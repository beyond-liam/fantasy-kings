"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type SwitchFieldProps = Omit<
  React.ComponentProps<typeof Switch>,
  "id" | "children"
> & {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  className?: string
}

function SwitchField({
  id,
  label,
  description,
  className,
  disabled,
  size = "default",
  ...props
}: SwitchFieldProps) {
  const labelId = `${id}-label`

  return (
    <div
      data-slot="switch-field"
      data-disabled={disabled ? true : undefined}
      className={cn(
        "group/switch-field flex items-start gap-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed",
        className,
      )}
    >
      <div className="mt-0.5 flex shrink-0">
        <Switch
          id={id}
          size={size}
          disabled={disabled}
          aria-labelledby={labelId}
          {...props}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 leading-snug">
        <Label
          htmlFor={id}
          id={labelId}
          className={cn(
            "cursor-pointer select-none text-sm leading-snug font-medium",
            "group-data-[disabled=true]/switch-field:cursor-not-allowed group-data-[disabled=true]/switch-field:opacity-75",
          )}
        >
          {label}
        </Label>
        {description ? (
          <p className="text-xs leading-normal text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { SwitchField }

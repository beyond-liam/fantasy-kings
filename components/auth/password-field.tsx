"use client";

import { useState } from "react";
import { EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  minLength?: number;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  invalid,
  required = true,
  minLength = 8,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field data-invalid={invalid ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((current) => !current)}
          >
            <HugeiconsIcon
              icon={visible ? ViewOffIcon : EyeIcon}
              strokeWidth={2}
            />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

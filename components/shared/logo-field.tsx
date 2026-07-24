"use client";

import { useId, useRef, useState } from "react";
import { ImageUpload01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  LOGO_ACCEPT,
  uploadLogoFile,
  type LogoKind,
} from "@/lib/logos";
import { cn } from "@/lib/utils";

export type LogoFieldMode = "keep" | "upload" | "url" | "remove";

export type LogoFieldValue = {
  logoMode: LogoFieldMode;
  logoUrl: string;
};

type LogoFieldProps = {
  kind: LogoKind;
  value: LogoFieldValue;
  initialLogoUrl: string | null;
  onChange: (next: Partial<LogoFieldValue>) => void;
  error?: string;
  label?: string;
  description?: string;
};

export function LogoField({
  kind,
  value,
  initialLogoUrl,
  onChange,
  error,
  label = "Logo",
  description = "Upload an image up to 2MB, or paste a public URL.",
}: LogoFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const previewUrl =
    value.logoMode === "remove"
      ? null
      : value.logoMode === "url" || value.logoMode === "upload"
        ? value.logoUrl.trim() || null
        : initialLogoUrl;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadLogoFile(file, kind);
      if (!result.success) {
        setUploadError(result.error);
        return;
      }
      onChange({ logoMode: "upload", logoUrl: result.url });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      <div className={cn("flex w-full flex-col gap-4 sm:flex-row sm:items-start", description ? "mt-3" : "mt-1.5")}>
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
        <RadioGroup
          variant="card"
          value={value.logoMode}
          onValueChange={(next) => {
            if (
              next === "keep" ||
              next === "upload" ||
              next === "url" ||
              next === "remove"
            ) {
              setUploadError(null);
              onChange({ logoMode: next });
            }
          }}
          className="min-w-0 w-full flex-1"
        >
          <RadioGroupItem value="keep">Keep unchanged</RadioGroupItem>
          <RadioGroupItem value="upload">From my device</RadioGroupItem>
          <RadioGroupItem value="url">From web URL</RadioGroupItem>
          <RadioGroupItem value="remove">Remove</RadioGroupItem>
        </RadioGroup>
      </div>

      {/* Always reserve control height so League name / Team name don't jump. */}
      <div className="mt-3 flex min-h-9 w-full flex-col gap-2">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={LOGO_ACCEPT}
          className="sr-only"
          disabled={isUploading || value.logoMode !== "upload"}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
          }}
        />
        {value.logoMode === "upload" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <HugeiconsIcon
                  icon={ImageUpload01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
              )}
              {isUploading ? "Uploading…" : "Choose image"}
            </Button>
            {uploadError ? <FieldError>{uploadError}</FieldError> : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </>
        ) : null}
        {value.logoMode === "url" ? (
          <>
            <Input
              value={value.logoUrl}
              onChange={(event) => onChange({ logoUrl: event.target.value })}
              placeholder="https://…"
              aria-label="Logo URL"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </>
        ) : null}
      </div>
    </Field>
  );
}

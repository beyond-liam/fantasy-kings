import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Image
          src="/fk-logo-stacked.svg"
          alt="Fantasy Kings"
          width={120}
          height={120}
          className="mx-auto mb-4"
          loading="eager"
        />
        <Card>
          <CardContent>
            <Suspense fallback={null}>
              <ForgotPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

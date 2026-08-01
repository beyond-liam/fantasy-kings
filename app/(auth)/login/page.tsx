import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Suspense } from "react";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Image src="/fk-logo-stacked.svg" alt="Fantasy Kings" width={120} height={120} className="mb-4 mx-auto" loading="eager" />
        <Card>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

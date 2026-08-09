import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Update Password",
};

export default async function UpdatePasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/forgot-password");
  }

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
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

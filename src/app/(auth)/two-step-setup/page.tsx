"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { TwoStepCard } from "@/components/people/profile/TwoStepCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

/**
 * Two-step sign-in, set up before anything else.
 *
 * The workspace requires it of this person and they have not set it up, so
 * the API refuses everything but this. Once it is on, they carry on.
 */
export default function TwoStepSetupPage() {
  const { user, isAuthenticated, isLoading, logout, reloadSession } = useAuth();
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin?next=/two-step-setup");
  }, [isLoading, isAuthenticated, router]);

  const carryOn = async () => {
    await reloadSession();
    router.replace("/");
  };

  return (
    <>
      <div className="mb-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up two-step sign-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace requires a code from an authenticator app after your password. Set it up to continue.
        </p>
      </div>
      <TwoStepCard onEnabled={() => setDone(true)} />
      {done && (
        <Button className="mt-6 h-12 w-full font-semibold" onClick={() => void carryOn()}>
          I have saved my recovery codes — continue
        </Button>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {user ? `Signed in as ${user.email}. ` : ""}
        <Button variant="link" className="h-auto p-0" onClick={() => void logout()}>
          Sign out
        </Button>
      </p>
    </>
  );
}

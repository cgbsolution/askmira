"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

import { SOCIAL_LABEL } from "./signinState";

/**
 * "Continue with Google / Microsoft". Shown only for providers this AskMira has
 * an OAuth app for; they sign in somebody who already has a login.
 */
export function SocialButtons({ providers, next }: { providers: string[]; next: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (providers.length === 0) return null;

  const start = async (provider: string) => {
    setBusy(provider);
    try {
      if (next) window.sessionStorage.setItem("askmira_signin_next", next);
      const redirect = `${window.location.origin}/signin/social/${provider}`;
      const result = await post<{ authorization_url: string }>(
        `/auth/social/${provider}/start`,
        { redirect_uri: redirect },
        { skipAuthRedirect: true },
      );
      window.location.assign(result.authorization_url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not start that sign-in.");
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="h-12 font-medium"
          disabled={busy !== null}
          onClick={() => void start(provider)}
        >
          {busy === provider ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Image src={`/brands/${provider}.svg`} alt="" width={18} height={18} />
          )}
          Continue with {SOCIAL_LABEL[provider] ?? provider}
        </Button>
      ))}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import React, { Suspense, useMemo } from "react";

import { ExternalSignIn, finishSocial } from "@/components/auth/ExternalSignIn";
import { SOCIAL_LABEL } from "@/components/auth/signinState";

function SocialReturn() {
  const { provider } = useParams<{ provider: string }>();
  const finish = useMemo(() => finishSocial(provider), [provider]);
  return <ExternalSignIn label={SOCIAL_LABEL[provider] ?? provider} finish={finish} />;
}

export default function SocialReturnPage() {
  return (
    <Suspense>
      <SocialReturn />
    </Suspense>
  );
}

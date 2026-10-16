"use client";

import React, { Suspense } from "react";

import { ExternalSignIn, finishSso } from "@/components/auth/ExternalSignIn";

/** Where a company's identity provider sends the browser back (OpenID Connect). */
export default function SsoReturnPage() {
  return (
    <Suspense>
      <ExternalSignIn label="Single sign-on" finish={finishSso} />
    </Suspense>
  );
}

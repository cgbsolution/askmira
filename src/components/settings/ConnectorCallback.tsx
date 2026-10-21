"use client";

import { CheckCircle2, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, post } from "@/lib/api";

import type { Connector } from "./ConnectorsScreen";

/**
 * Where a product sends the admin back after Allow. Hands the one-time code and
 * the state to AskMira's server, which swaps them for this workspace's key, then
 * returns to Connectors. The code is wiped from the address bar first.
 */
export function ConnectorCallback() {
  const router = useRouter();
  const [result, setResult] = useState<{ ok: true; connector: Connector } | { ok: false; message: string } | null>(
    null,
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const product = params.get("product");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code || !state || (product !== "interview" && product !== "expense")) {
      setResult({ ok: false, message: "This link is missing its connect code. Press Connect again." });
      return;
    }
    post<Connector>(`/connectors/${product}/complete`, { code, state })
      .then((connector) => {
        setResult({ ok: true, connector });
        window.setTimeout(() => router.replace("/settings/connectors"), 1500);
      })
      .catch((caught: unknown) =>
        setResult({
          ok: false,
          message: caught instanceof ApiError ? caught.detail : "Could not finish connecting. Press Connect again.",
        }),
      );
  }, [router]);

  return (
    <PageShell title="Connecting" description="Finishing the connection with the product.">
      <Card tier="tier1" className="mx-auto max-w-lg">
        <CardContent className="py-6">
          {result === null ? (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Connecting…
            </div>
          ) : result.ok ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{result.connector.brand} is connected</AlertTitle>
              <AlertDescription>
                {result.connector.organization
                  ? `Connected to “${result.connector.organization}”. `
                  : ""}
                Your people are being sent across. Taking you back to Connectors…
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3">
              <Alert>
                <Info />
                <AlertTitle>Not connected</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
              <Button variant="outline" asChild>
                <Link href="/settings/connectors">Back to Connectors</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

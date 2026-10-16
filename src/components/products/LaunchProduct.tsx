"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, post } from "@/lib/api";
import { PRODUCTS } from "@/lib/access";
import type { ProductKey } from "@/lib/types";

function isProduct(value: string): value is ProductKey {
  return value in PRODUCTS;
}

/**
 * Opens a linked product. Asks the API for a one-time sign-in link (good for a
 * minute) and goes straight there, so the person never types a password twice.
 */
export function LaunchProduct({ product }: { product: string }) {
  const [error, setError] = useState<string | null>(null);
  // One link per visit, even when React runs the effect twice in development.
  const started = useRef(false);

  const open = useCallback(async () => {
    if (!isProduct(product)) {
      setError("There is no such product.");
      return;
    }
    setError(null);
    try {
      const { url } = await post<{ url: string }>(`/products/${product}/launch`);
      window.location.replace(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Could not open it. Try again.");
    }
  }, [product]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  const name = isProduct(product) ? PRODUCTS[product].name : "the product";

  return (
    <Card tier="tier2" className="mx-auto mt-10 max-w-lg">
      <CardContent className="py-6">
        {error ? (
          <div className="flex flex-col items-center gap-2">
            <ErrorState message={error} onRetry={() => void open()} className="py-6" />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ExternalLink className="size-6" />
            </span>
            <p className="font-semibold text-foreground">Opening {name}…</p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Signing you in
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

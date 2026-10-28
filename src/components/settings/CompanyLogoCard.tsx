"use client";

import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ApiError, del, get, post } from "@/lib/api";
import { HiddenFileInput } from "@/components/ui/file-input";

/**
 * Settings → Company → Workspace: the logo on this company's own sign-in page.
 * PNG or JPEG, up to 1 MB. It is public, like the logo on the company's website.
 */
export function CompanyLogoCard() {
  const { tenant } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenant?.slug) return;
    get<{ logo_url: string | null }>(`/public/workspaces/${tenant.slug}`)
      .then((result) => setLogoUrl(result.logo_url))
      .catch(() => setLogoUrl(null));
  }, [tenant?.slug]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await post<{ logo_url: string }>("/org/logo", form);
      setLogoUrl(result.logo_url);
      toast.success("Logo updated. It shows on your sign-in page now.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not upload the logo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del("/org/logo");
      setLogoUrl(null);
      toast.success("Logo removed.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not remove the logo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company logo</CardTitle>
        <CardDescription>
          Shown on your company&apos;s sign-in page{tenant?.slug ? ` (/signin/${tenant.slug})` : ""}. PNG or JPEG,
          up to 1 MB.
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {logoUrl ? "Replace" : "Upload"}
          </Button>
          {logoUrl ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()} aria-label="Remove logo">
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        <HiddenFileInput
          ref={input}
          accept="image/png,image/jpeg"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Company logo" className="max-h-16 max-w-[220px] object-contain" />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4" /> No logo yet — the sign-in page shows your company name.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

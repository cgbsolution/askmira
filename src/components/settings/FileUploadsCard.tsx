"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { patch } from "@/lib/api";
import type { TenantSettings } from "@/lib/types/admin";
import { DEFAULT_UPLOAD_MB, UPLOAD_LIMIT_CHOICES } from "@/lib/uploads";

import { errorDetail } from "./settingsShared";

/**
 * Settings → Company → Workspace: the largest file anyone can upload, anywhere
 * in AskMiraa, and what happens to every file before it is stored.
 *
 * Saved with the other workspace settings (PATCH /admin/tenant, audited), then
 * the session is read again so every upload screen shows the new limit at once.
 */
export function FileUploadsCard() {
  const { tenant, hasRole, reloadSession } = useAuth();
  const current = tenant?.max_upload_mb ?? DEFAULT_UPLOAD_MB;
  const [chosen, setChosen] = useState(String(current));
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = hasRole("admin");

  useEffect(() => setChosen(String(current)), [current]);

  const save = async () => {
    setIsSaving(true);
    try {
      await patch<TenantSettings>("/admin/tenant", { max_upload_mb: Number(chosen) });
      await reloadSession();
      toast.success(`Saved. Files up to ${chosen} MB can be uploaded.`);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the upload limit."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>File uploads</CardTitle>
        <CardDescription>
          One limit for every upload in AskMiraa: documents, photos, logos, receipts, bills, résumés and
          import sheets, on the portal and the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-3">
          <FormField
            htmlFor="upload-limit"
            label="Largest file anyone can upload"
            hint="A larger file is refused as it is picked, with its size and this limit. A ZIP of many documents can hold up to 200 MB; each file in it follows this limit."
          >
            <Select value={chosen} onValueChange={setChosen} disabled={!canEdit || isSaving}>
              <SelectTrigger id="upload-limit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPLOAD_LIMIT_CHOICES.map((mb) => (
                  <SelectItem key={mb} value={String(mb)}>
                    {mb} MB{mb === DEFAULT_UPLOAD_MB ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {canEdit ? (
            <div>
              <Button onClick={() => void save()} disabled={isSaving || chosen === String(current)}>
                {isSaving && <Loader2 className="animate-spin" />} Save limit
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Only an admin can change the limit.</p>
          )}
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">Every file is compressed before it is stored</p>
          <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-muted-foreground">
            <li>
              Photos are turned upright, resized to at most 2,400 pixels on the longer side and saved again. The
              location a phone writes into a photo is removed.
            </li>
            <li>Scanned PDFs keep every page and their text; the scanned images inside are shrunk.</li>
            <li>
              Digitally signed PDFs, such as Form 16 from TRACES, and password-protected PDFs are kept exactly as
              uploaded, so their signatures stay valid.
            </li>
            <li>A file is replaced only when the compressed copy is smaller.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

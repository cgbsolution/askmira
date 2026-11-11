"use client";

import { BadgeCheck, Building2, Download, Loader2, PenLine, ShieldAlert } from "lucide-react";
import React, { useEffect, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { LetterPages } from "@/components/docs/LetterPages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, downloadFile, get, post } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

type Described = {
  state: "waiting" | "acknowledged" | "withdrawn" | "not_issued" | "changed";
  company_name: string;
  logo_url: string | null;
  letter_name: string;
  reference_number: string;
  employee_name: string;
  issued_at: string | null;
  page_count: number;
  acknowledged_at: string | null;
  acknowledged_name: string | null;
  has_signed_copy: boolean;
};

const SIGNATURE_LIMIT = 5 * 1024 * 1024;
const SIGNATURE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const CLOSED: Record<string, { title: string; text: string }> = {
  withdrawn: {
    title: "This letter has been withdrawn",
    text: "HR withdrew this letter, so it can no longer be signed. Contact HR if you have questions.",
  },
  not_issued: {
    title: "This letter is not ready yet",
    text: "It is still waiting for approval. You will get an email when it is ready to sign.",
  },
  changed: {
    title: "This letter cannot be signed",
    text: "It does not match the copy recorded when it was issued. Contact HR before signing anything.",
  },
};

function problemOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * The page a letter email's "Read and sign" button opens. No sign-in: the link
 * names one letter and the person it was issued to. The letter is shown as its
 * PDF prints; the person ticks, types their name and uploads their signature,
 * which is printed into their signed copy and not kept.
 */
export function LetterLinkScreen({ token }: { token: string }) {
  const base = `/public/letters/${encodeURIComponent(token)}`;
  const [described, setDescribed] = useState<Described | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = React.useCallback(async () => {
    try {
      setDescribed(await get<Described>(base, { skipAuthRedirect: true }));
      setProblem(null);
    } catch (caught) {
      setProblem(problemOf(caught, "This link could not be opened. Check your connection and try again."));
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async () => {
    if (!described) return;
    const signed = described.state === "acknowledged";
    const name = `${described.letter_name} - ${described.reference_number.replace(/\//g, "_")}${signed ? "-signed" : ""}.pdf`;
    try {
      await downloadFile(`${base}/pdf`, name, { skipAuthRedirect: true });
    } catch (caught) {
      setProblem(problemOf(caught, "The PDF could not be downloaded. Try again."));
    }
  };

  const closed = described ? CLOSED[described.state] : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex justify-center">
        {described?.logo_url ? (
          // A company's own uploaded logo; its size is not known in advance.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={described.logo_url} alt={described.company_name} className="max-h-12 max-w-[200px] object-contain" />
        ) : (
          <span className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
            <Building2 className="size-5" />
            {described?.company_name ?? "AskMiraa"}
          </span>
        )}
      </div>

      <Card tier="tier2">
        {!described && !problem ? (
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="aspect-[1/1.414] w-full" />
          </CardContent>
        ) : !described ? (
          <CardContent className="py-6">
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>This link cannot be used</AlertTitle>
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="font-display text-xl">{described.letter_name}</CardTitle>
              <CardDescription>
                {described.reference_number} · For {described.employee_name}
                {described.issued_at ? ` · Issued ${formatDate(described.issued_at)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {described.state === "acknowledged" ? (
                <Alert variant="success">
                  <BadgeCheck />
                  <AlertTitle>Signed and accepted</AlertTitle>
                  <AlertDescription>
                    You accepted this letter on {formatDateTime(described.acknowledged_at)}
                    {described.acknowledged_name ? ` as “${described.acknowledged_name}”` : ""}. HR has
                    your signed copy; download yours below.
                  </AlertDescription>
                </Alert>
              ) : closed ? (
                <Alert variant="destructive">
                  <ShieldAlert />
                  <AlertTitle>{closed.title}</AlertTitle>
                  <AlertDescription>{closed.text}</AlertDescription>
                </Alert>
              ) : null}

              {described.state === "waiting" || described.state === "acknowledged" ? (
                <LetterPages
                  count={described.page_count}
                  pagePath={(page) => `${base}/pages/${page}`}
                  title={`${described.letter_name} ${described.reference_number}`}
                  version={version}
                  publicPage
                  className="max-h-[75vh]"
                />
              ) : null}

              {described.state === "waiting" ? (
                <SignForm
                  base={base}
                  employeeName={described.employee_name}
                  onSigned={async () => {
                    await load();
                    setVersion((value) => value + 1);
                  }}
                />
              ) : null}

              {problem ? (
                <Alert variant="destructive">
                  <AlertDescription>{problem}</AlertDescription>
                </Alert>
              ) : null}

              {described.state === "waiting" || described.state === "acknowledged" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={described.state === "acknowledged" ? "default" : "outline"}
                    onClick={() => void download()}
                  >
                    <Download />
                    {described.state === "acknowledged" ? "Download signed copy" : "Download PDF"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </>
        )}
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Sent by {described?.company_name ?? "your company"} · Powered by AskMiraa
      </p>
    </div>
  );
}

function SignForm({
  base,
  employeeName,
  onSigned,
}: {
  base: string;
  employeeName: string;
  onSigned: () => Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [typed, setTyped] = useState("");
  const [signature, setSignature] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signature) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(signature);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  const choose = (file: File | null) => {
    setSignatureError(null);
    setError(null);
    if (file && !SIGNATURE_TYPES.includes(file.type)) {
      setSignature(null);
      setSignatureError("Choose a PNG or JPG picture of your signature.");
      return;
    }
    setSignature(file);
  };

  const sign = async () => {
    if (busy || !signature) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("typed_name", typed.trim());
    form.append("accept", agreed ? "true" : "false");
    form.append("signature", signature);
    try {
      await post(`${base}/acknowledge`, form, { skipAuthRedirect: true });
      await onSigned();
    } catch (caught) {
      const detail = problemOf(caught, "That did not go through. Check your connection and try again.");
      if (/signature|picture|photo|PNG|JPG/i.test(detail)) setSignatureError(detail);
      else setError(detail);
    } finally {
      setBusy(false);
    }
  };

  const ready = agreed && typed.trim().length > 0 && signature !== null && !busy;

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Sign & accept</p>
        <p className="text-xs text-muted-foreground">
          Your signature and today&apos;s date are printed on the letter, and the signed copy is
          kept as your letter. Your acceptance is recorded with the time and a fingerprint of this
          exact text.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="letter-agree" checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} />
        <Label htmlFor="letter-agree" className="text-sm font-normal leading-snug">
          I have read this letter and I accept it.
        </Label>
      </div>
      <FormField
        htmlFor="letter-name"
        label="Type your full name"
        required
        hint={`As on your record: “${employeeName}”.`}
        error={error}
      >
        <Input
          id="letter-name"
          autoComplete="name"
          maxLength={255}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setError(null);
          }}
        />
      </FormField>
      <FormField
        htmlFor="letter-signature"
        label="Your signature"
        required
        hint="A photo or scan of your signature in dark ink on white paper, PNG or JPG, up to 5 MB. It is used only to sign this letter and is not saved."
        error={signatureError}
      >
        <FileInput
          id="letter-signature"
          accept="image/png,image/jpeg,image/webp"
          maxBytes={SIGNATURE_LIMIT}
          file={signature}
          buttonLabel="Upload signature"
          placeholder="No signature chosen"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </FormField>
      {preview ? (
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-border bg-white px-4 py-2">
            {/* The person's own chosen file, shown before it is sent. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your signature" className="h-12 max-w-[220px] object-contain" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => choose(null)}>
            Remove
          </Button>
        </div>
      ) : null}
      <div>
        <Button disabled={!ready} onClick={() => void sign()}>
          {busy ? <Loader2 className="animate-spin" /> : <PenLine />} Sign & accept
        </Button>
      </div>
    </div>
  );
}

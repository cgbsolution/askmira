"use client";

import {
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, get, post } from "@/lib/api";

import { shrinkPhoto } from "./shrinkPhoto";
import { HiddenFileInput } from "@/components/ui/file-input";

interface KioskInfo {
  kiosk_name: string;
  workspace: string | null;
  location: string | null;
  photo_mode: "off" | "optional" | "required";
  pin_lengths: [number, number];
}

interface KioskResult {
  first_name: string;
  direction: "in" | "out";
  punched_at: string;
  photo_taken: boolean;
}

const clock = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const RESET_AFTER_MS = 6_000;

/**
 * A shared tablet at a gate or reception. A person types their employee code
 * and PIN; in or out follows their last punch. Nothing about anyone stays on
 * screen: the result clears itself after a few seconds.
 */
export function KioskScreen({ token }: { token: string }) {
  const [info, setInfo] = useState<KioskInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [useBadge, setUseBadge] = useState(false);
  const [badge, setBadge] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KioskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get<KioskInfo>(`/kiosk/${encodeURIComponent(token)}`, {
      skipAuthRedirect: true,
    })
      .then(setInfo)
      .catch((caught) =>
        setProblem(
          caught instanceof ApiError
            ? caught.detail
            : "This kiosk could not be reached.",
        ),
      );
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!result && !error) return;
    const timer = setTimeout(() => {
      setResult(null);
      setError(null);
      codeRef.current?.focus();
    }, RESET_AFTER_MS);
    return () => clearTimeout(timer);
  }, [result, error]);

  const reset = () => {
    setCode("");
    setPin("");
    setBadge("");
    setPhoto(null);
    setPhotoKey((key) => key + 1);
  };

  const punch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (info?.photo_mode === "required" && !photo) {
      setError(
        "This workspace takes a photo with every punch. Tap the camera first.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const done = await post<KioskResult>(
        `/kiosk/${encodeURIComponent(token)}/punch`,
        useBadge
          ? {
              badge: badge.trim(),
              photo: info?.photo_mode !== "off" ? photo : null,
            }
          : {
              employee_code: code.trim(),
              pin,
              photo: info?.photo_mode !== "off" ? photo : null,
            },
        { skipAuthRedirect: true },
      );
      setResult(done);
      reset();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
          : "The punch did not go through.",
      );
      setPin("");
      setBadge("");
    } finally {
      setBusy(false);
    }
  };

  if (problem) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-md">
        <AlertDescription>{problem}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card tier="tier1" className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-4xl tabular-nums">
          {clock.format(now)}
        </CardTitle>
        <CardDescription>
          {info
            ? [info.workspace, info.location ?? info.kiosk_name]
                .filter(Boolean)
                .join(" · ")
            : "Loading…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          <div
            className="grid justify-items-center gap-3 py-6 text-center"
            role="status"
          >
            <CheckCircle2 className="size-12 text-primary" />
            <p className="text-2xl font-semibold">
              {result.direction === "in" ? "Welcome" : "Goodbye"},{" "}
              {result.first_name}
            </p>
            <Badge
              variant={result.direction === "in" ? "success" : "secondary"}
              className="text-sm"
            >
              {result.direction === "in" ? <LogIn /> : <LogOut />}
              Punched {result.direction} at{" "}
              {clock.format(new Date(result.punched_at))}
            </Badge>
          </div>
        ) : (
          <form onSubmit={(e) => void punch(e)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={useBadge ? "outline" : "default"}
                onClick={() => setUseBadge(false)}
              >
                Code and PIN
              </Button>
              <Button
                type="button"
                variant={useBadge ? "default" : "outline"}
                onClick={() => setUseBadge(true)}
              >
                Badge
              </Button>
            </div>
            {useBadge ? (
              <div className="grid gap-1.5">
                <Label htmlFor="kiosk-badge">
                  Tap your badge on the reader
                </Label>
                <Input
                  id="kiosk-badge"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  className="h-14 text-center text-2xl"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="kiosk-code">Employee code</Label>
                  <Input
                    ref={codeRef}
                    id="kiosk-code"
                    autoComplete="off"
                    autoFocus
                    className="h-14 text-center text-2xl tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="kiosk-pin">PIN</Label>
                  <Input
                    id="kiosk-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    className="h-14 text-center text-2xl tracking-[0.5em]"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </>
            )}
            {info && info.photo_mode !== "off" && (
              <div className="flex items-center justify-center gap-2">
                <Label
                  htmlFor="kiosk-photo"
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-normal"
                >
                  <Camera className="size-4" />
                  {photo
                    ? "Photo ready — retake"
                    : info.photo_mode === "required"
                      ? "Take a photo"
                      : "Add a photo"}
                </Label>
                <HiddenFileInput
                  key={photoKey}
                  id="kiosk-photo"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      shrinkPhoto(file)
                        .then(setPhoto)
                        .catch(() => setError("The photo could not be used."));
                  }}
                />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-14 text-lg"
              disabled={
                busy ||
                (useBadge
                  ? badge.trim().length < 4
                  : !code.trim() || pin.length < 4)
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : <Clock />} Punch
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No PIN yet? Set one on your Attendance page.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

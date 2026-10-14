"use client";

import { Loader2, UserRoundCheck, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Delegation {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  cancelled: boolean;
}

interface Delegate {
  user_id: string;
  name: string;
  email: string;
}

/**
 * Away? Hand your approvals to a colleague for the dates you are out. They can
 * then decide whatever is waiting on you; the record shows it was them.
 */
export function DelegationCard() {
  const { user } = useAuth();
  const delegations = useApiQuery<Delegation[]>("/approvals/delegations");
  const delegates = useApiQuery<Delegate[]>("/approvals/delegates");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const live = (delegations.data ?? []).filter((d) => !d.cancelled && d.ends_on >= today);

  const save = async () => {
    setBusy(true);
    try {
      await post("/approvals/delegations", {
        to_user_id: to,
        starts_on: from,
        ends_on: until,
        reason: reason.trim() || undefined,
      });
      toast.success("Handed over. They will see your approvals for those dates.");
      setTo("");
      setReason("");
      setFrom("");
      setUntil("");
      delegations.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It could not be set up.");
    } finally {
      setBusy(false);
    }
  };

  const end = async (row: Delegation) => {
    try {
      await del(`/approvals/delegations/${row.id}`);
      delegations.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It could not be ended.");
    }
  };

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundCheck className="size-4 text-primary" /> Away? Hand over your approvals
        </CardTitle>
        <CardDescription>Your stand-in decides what waits on you for those dates. Every decision shows who took it.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {live.length > 0 && (
          <ul className="grid gap-2">
            {live.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {row.from_user_id === user?.id ? `You → ${row.to_name}` : `${row.from_name} → you`}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDate(row.starts_on)} to {formatDate(row.ends_on)}
                  {row.reason ? ` · ${row.reason}` : ""}
                </span>
                {row.from_user_id === user?.id && (
                  <Button size="sm" variant="ghost" aria-label="End this hand-over" onClick={() => void end(row)}>
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField htmlFor="delegate-to" label="Stand-in">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id="delegate-to" className="w-full">
                <SelectValue placeholder={delegates.isLoading ? "Loading…" : "Choose a colleague"} />
              </SelectTrigger>
              <SelectContent>
                {(delegates.data ?? []).map((option) => (
                  <SelectItem key={option.user_id} value={option.user_id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="delegate-from" label="From">
            <DatePicker id="delegate-from" value={from} onChange={setFrom} />
          </FormField>
          <FormField htmlFor="delegate-until" label="Until">
            <DatePicker id="delegate-until" value={until} onChange={setUntil} />
          </FormField>
          <FormField htmlFor="delegate-reason" label="Why" optional>
            <Input id="delegate-reason" maxLength={255} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="On leave" />
          </FormField>
        </div>
        <div>
          <Button disabled={busy || !to || !from || !until} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Hand over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

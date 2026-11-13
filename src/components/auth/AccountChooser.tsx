"use client";

import { ChevronRight, Loader2, UserPlus, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { SavedAccountSummary, useChooseAccount } from "@/components/auth/AccountSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError, post } from "@/lib/api";
import type { SavedAccount } from "@/lib/types";

/**
 * Sign-in, when accounts are already signed in on this browser: pick one to
 * continue, or sign in to another. Removing one here forgets it on this
 * browser (and signs it out, when it is the active one).
 */
export function AccountChooser({
  accounts,
  next,
  onUseAnother,
  onChange,
}: {
  accounts: SavedAccount[];
  next: string | null;
  onUseAnother: () => void;
  /** The list after an account was removed. */
  onChange: (accounts: SavedAccount[]) => void;
}) {
  const { reloadSession } = useAuth();
  const { choose, busy } = useChooseAccount(next);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(account: SavedAccount) {
    setRemoving(account.user_id);
    try {
      await post("/auth/accounts/forget", { user_id: account.user_id }, { skipAuthRedirect: true });
      if (account.current) await reloadSession();
      onChange(accounts.filter((other) => other.user_id !== account.user_id));
      toast.success(`${account.full_name} (${account.workspace_name}) removed from this browser.`);
    } catch (failure) {
      toast.error(failure instanceof ApiError ? failure.detail : "Could not remove that account.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Choose an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These accounts are signed in on this browser. Pick one to continue.
        </p>
      </div>

      <ul className="grid gap-2" aria-label="Accounts signed in on this browser">
        {accounts.map((account) => (
          <li
            key={account.user_id}
            className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 transition-colors hover:bg-muted/40"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-lg p-2 text-left hover:bg-transparent"
              disabled={busy !== null || removing !== null}
              // The active one goes through the switch too: its session may have
              // timed out, and the switch is what finds that out.
              onClick={() => void choose(account)}
            >
              <SavedAccountSummary account={account} showEmail />
              {account.current ? (
                <Badge variant="muted" className="shrink-0">
                  Signed in
                </Badge>
              ) : busy === account.user_id ? (
                <Loader2 className="shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className="shrink-0 text-muted-foreground" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${account.full_name} (${account.workspace_name}) from this browser`}
              title="Remove from this browser"
              disabled={busy !== null || removing !== null}
              onClick={() => void remove(account)}
            >
              {removing === account.user_id ? <Loader2 className="animate-spin" /> : <X />}
            </Button>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" className="mt-5 h-12 w-full font-semibold" onClick={onUseAnother}>
        <UserPlus /> Use another account
      </Button>
    </>
  );
}

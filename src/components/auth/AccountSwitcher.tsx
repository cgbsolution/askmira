"use client";

import { Building2, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { rememberLogin } from "@/components/auth/signinState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { SavedAccount } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

/**
 * Switching between the accounts signed in on this browser.
 *
 * Someone who runs HR for several workspaces has a login in each. Each one
 * they sign in to stays signed in here (the server keeps the list in an
 * httpOnly cookie the page never sees), and the account menu switches between
 * them in one click — no password, but every workspace's own rules (idle
 * timeout, IP allowlist, two-step) still apply. One account is active per
 * browser at a time; a switch reloads every open tab.
 */

/** The accounts signed in on this browser, read again each time `open` turns true. */
export function useSavedAccounts(open: boolean): SavedAccount[] {
  const { savedAccounts, user } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    savedAccounts()
      .then((found) => {
        if (live) setAccounts(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, savedAccounts, user?.id]);
  return accounts;
}

/**
 * Switches to a saved account; when its session has ended, opens its
 * workspace's sign-in with the email filled in instead.
 */
export function useChooseAccount(next?: string | null): {
  choose: (account: SavedAccount) => Promise<void>;
  busy: string | null;
} {
  const { switchAccount } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const choose = useCallback(
    async (account: SavedAccount) => {
      setBusy(account.user_id);
      try {
        await switchAccount(account.user_id, next);
        // The page reloads; `busy` stays on until it does.
      } catch (failure) {
        setBusy(null);
        if (failure instanceof ApiError && failure.status === 401) {
          rememberLogin(account.email);
          toast.info(`Your session in ${account.workspace_name} has ended. Sign in again to switch to it.`);
          const query = next ? `?next=${encodeURIComponent(next)}` : "";
          router.push(`/signin/${account.workspace}${query}`);
          return;
        }
        toast.error(failure instanceof ApiError ? failure.detail : "Could not switch account. Try again.");
      }
    },
    [next, router, switchAccount],
  );

  return { choose, busy };
}

/** Avatar, name, and the workspace the account belongs to. */
export function SavedAccountSummary({
  account,
  className,
  showEmail = false,
}: {
  account: SavedAccount;
  className?: string;
  showEmail?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>
      <Avatar className="size-9 shrink-0">
        {account.photo_url && <AvatarImage src={account.photo_url} alt="" />}
        <AvatarFallback className="bg-brand-100 text-xs font-semibold text-brand-600 dark:bg-brand-800 dark:text-brand-100">
          {initials(account.full_name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-semibold text-foreground">{account.full_name}</span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0" />
          <span className="truncate">{account.workspace_name}</span>
        </span>
        {showEmail ? <span className="truncate text-xs text-muted-foreground">{account.email}</span> : null}
      </span>
    </span>
  );
}

/**
 * The switcher's part of an account dropdown: the other accounts signed in
 * here, and "Add another account". Render inside a `DropdownMenuContent`.
 */
export function AccountSwitchItems({
  accounts,
  itemClassName,
  onNavigate,
}: {
  accounts: SavedAccount[];
  itemClassName?: string;
  /** Called before following the "Add another account" link (closes a mobile drawer). */
  onNavigate?: () => void;
}) {
  const t = useT();
  const { choose, busy } = useChooseAccount();
  const others = accounts.filter((account) => !account.current);

  return (
    <>
      {others.length > 0 ? (
        <>
          <DropdownMenuLabel className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground">
            {t("Switch account")}
          </DropdownMenuLabel>
          {others.map((account) => (
            <DropdownMenuItem
              key={account.user_id}
              className={cn("rounded-lg px-3 py-2", itemClassName)}
              disabled={busy !== null}
              title={account.email}
              onSelect={(event) => {
                event.preventDefault();
                void choose(account);
              }}
            >
              <SavedAccountSummary account={account} className={busy === account.user_id ? "opacity-60" : undefined} />
            </DropdownMenuItem>
          ))}
        </>
      ) : null}
      <DropdownMenuItem asChild className={cn("gap-3 rounded-lg px-3 py-2 font-medium", itemClassName)}>
        <Link href="/signin?add=1" onClick={onNavigate}>
          <UserPlus /> {t("Add another account")}
        </Link>
      </DropdownMenuItem>
    </>
  );
}

/** "Sign out", and "Sign out of all accounts" when more than one is signed in here. */
export function SignOutItems({ accounts, itemClassName }: { accounts: SavedAccount[]; itemClassName?: string }) {
  const t = useT();
  const { logout } = useAuth();
  const several = accounts.filter((account) => !account.current).length > 0;
  return (
    <>
      <DropdownMenuSeparator className="my-2" />
      <DropdownMenuItem
        variant="destructive"
        className={cn("gap-3 rounded-lg px-3 py-2 font-medium", itemClassName)}
        onClick={() => void logout()}
      >
        <LogOut /> {t("Sign out")}
      </DropdownMenuItem>
      {several ? (
        <DropdownMenuItem
          variant="destructive"
          className={cn("gap-3 rounded-lg px-3 py-2 font-medium", itemClassName)}
          onClick={() => void logout({ everyAccount: true })}
        >
          <LogOut /> {t("Sign out of all accounts")}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

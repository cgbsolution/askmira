"use client";

import { KeyRound } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";

/** "key=value" lines to an object. Returns an error message for the first bad line. */
function parseSettings(text: string): { value: Record<string, string> } | { error: string } {
  const value: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const at = line.indexOf("=");
    if (at <= 0) return { error: `Line ${index + 1} needs the form key=value.` };
    const key = line.slice(0, at).trim();
    if (!key) return { error: `Line ${index + 1} has no key.` };
    if (key in value) return { error: `"${key}" appears more than once.` };
    value[key] = line.slice(at + 1).trim();
  }
  return { value };
}

/**
 * Store (or replace) the account for one board (admin). The secret is
 * write-only: it is encrypted by the server and never shown again, so the
 * form never pre-fills it.
 */
export function BoardAccountDialog({
  board,
  boardName,
  hasAccount,
  onSaved,
}: {
  board: string;
  boardName: string;
  hasAccount: boolean;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [settings, setSettings] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"secret" | "settings", string>>>({});

  const reset = () => {
    setDisplayName("");
    setUsername("");
    setSecret("");
    setSettings("");
    setErrors({});
  };

  const submit = async (): Promise<boolean> => {
    const next: typeof errors = {};
    if (!secret) next.secret = "Enter the API key or password for this board.";
    const parsed = parseSettings(settings);
    if ("error" in parsed) next.settings = parsed.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || "error" in parsed) return false;
    try {
      await post("/job-boards/accounts", {
        board,
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        secret,
        settings: parsed.value,
      });
      toast.success(`${boardName} account saved`, {
        description: "Credentials are stored. A live connection has still not been verified.",
      });
      onSaved();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not save the account.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm" variant="outline">
          <KeyRound /> {hasAccount ? "Replace account" : "Add account"}
        </Button>
      }
      title={`${hasAccount ? "Replace" : "Add"} ${boardName} account`}
      description="The secret is encrypted before it is stored and is never shown again."
      submitLabel="Save account"
      onSubmit={submit}
      onClosed={reset}
    >
      <FormField htmlFor={`board-display-${board}`} label="Display name" optional>
        <Input
          id={`board-display-${board}`}
          value={displayName}
          maxLength={128}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </FormField>
      <FormField htmlFor={`board-username-${board}`} label="Username" optional>
        <Input
          id={`board-username-${board}`}
          value={username}
          maxLength={255}
          autoComplete="off"
          onChange={(event) => setUsername(event.target.value)}
        />
      </FormField>
      <FormField htmlFor={`board-secret-${board}`} label="Secret" error={errors.secret}>
        <Input
          id={`board-secret-${board}`}
          type="password"
          value={secret}
          maxLength={4096}
          autoComplete="new-password"
          required
          onChange={(event) => setSecret(event.target.value)}
        />
      </FormField>
      <FormField
        htmlFor={`board-settings-${board}`}
        label="Settings"
        optional
        hint="One key=value per line. Values are stored as text."
        error={errors.settings}
      >
        <Textarea
          id={`board-settings-${board}`}
          value={settings}
          rows={4}
          className="font-mono text-xs"
          onChange={(event) => setSettings(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}

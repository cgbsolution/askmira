"use client";

import { PlugZap } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface Connection {
  id: string;
  client_name: string;
  scopes: string[];
  connected_at: string | null;
  last_used_at: string | null;
}

/** AI assistants the person connected (claude.ai, ChatGPT…), and a way to cut them off. */
export function ConnectedAppsCard() {
  const { data, reload } = useApiQuery<Connection[]>("/oauth/connections");
  if (!data || data.length === 0) return null;

  const disconnect = async (connection: Connection) => {
    try {
      await post(`/oauth/connections/${connection.id}/revoke`);
      toast.success(`${connection.client_name} is disconnected.`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It could not be disconnected.");
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="size-4" /> Connected apps
        </CardTitle>
        <CardDescription>Assistants you allowed to read AskMira as you. They cannot change anything.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {data.map((connection) => (
            <li key={connection.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{connection.client_name}</p>
                <p className="text-xs text-muted-foreground">
                  {connection.scopes.join(", ")} · connected {formatDateTime(connection.connected_at)}
                  {connection.last_used_at ? ` · last used ${formatDateTime(connection.last_used_at)}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void disconnect(connection)}>
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

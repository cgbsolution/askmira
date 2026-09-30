"use client";

import { CheckCircle2, ClipboardList, Laptop, Loader2, UserX } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { toastApiError } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AssetAssignment, AssetCategory, AssetRequest, MyAssets } from "@/lib/types/assets";

import { RequestAssetDialog } from "./RequestAssetDialog";
import {
  CONDITION_LABELS,
  dayOrDash,
  OutcomeBadge,
  QueryPanel,
  RequestStatusBadge,
  stampDay,
} from "./shared";

/**
 * My assets: what I hold, acknowledging receipt, what I have asked for, and
 * what I have handed back. Everything shown is my own record.
 */
export function MyAssetsScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const hasEmployee = Boolean(user?.employee_id);

  const mine = useApiQuery<MyAssets>(hasEmployee ? "/assets/me" : null);
  const requests = useApiQuery<AssetRequest[]>(hasEmployee ? "/assets/requests?scope=mine" : null);
  const categories = useApiQuery<AssetCategory[]>(hasEmployee ? "/assets/categories" : null);

  const body = () => {
    if (authLoading) return <DataPanel isLoading />;
    if (!hasEmployee) {
      return (
        <Card tier="tier1">
          <EmptyState
            icon={UserX}
            title="Your sign-in is not linked to an employee record"
            description="Assets are handed to employees. Ask HR to link your account to your employee record."
          />
        </Card>
      );
    }
    return (
      <>
        <QueryPanel
          title="With me now"
          description="Company assets handed to you. Acknowledge each one when you have it."
          query={mine}
          isEmpty={(data) => data.current.length === 0}
          empty={{
            icon: Laptop,
            title: "You hold no company assets",
            description:
              "When HR hands you a laptop, phone or access card, it appears here for you to acknowledge.",
          }}
        >
          {(data) => <CurrentTable rows={data.current} onChanged={mine.reload} />}
        </QueryPanel>

        <QueryPanel
          title="My requests"
          query={requests}
          isEmpty={(data) => data.length === 0}
          empty={{
            icon: ClipboardList,
            title: "No requests yet",
            description:
              "Use Request an asset to ask for something you need. Your manager or HR decides.",
          }}
        >
          {(data) => <RequestsTable rows={data} onChanged={requests.reload} />}
        </QueryPanel>

        {mine.data && mine.data.history.length > 0 && (
          <DataPanel
            title="Handed back"
            description="Assets you held before, and how each one ended."
          >
            <HistoryTable rows={mine.data.history} />
          </DataPanel>
        )}
      </>
    );
  };

  return (
    <PageShell
      title="My assets"
      description="The company equipment you hold, and the things you have asked for."
      actions={
        hasEmployee && categories.data ? (
          <RequestAssetDialog categories={categories.data} onCreated={requests.reload} />
        ) : undefined
      }
    >
      {body()}
    </PageShell>
  );
}

function CurrentTable({ rows, onChanged }: { rows: AssetAssignment[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const acknowledge = async (row: AssetAssignment) => {
    setBusyId(row.id);
    try {
      await post<AssetAssignment>(`/assets/assignments/${row.id}/acknowledge`);
      toast.success(`Acknowledged ${row.asset_tag}`);
      onChanged();
    } catch (caught) {
      toastApiError(caught, "The acknowledgement could not be saved.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>With you since</TableHead>
            <TableHead>Due back</TableHead>
            <TableHead>Condition at hand-over</TableHead>
            <TableHead className="text-right">Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium text-foreground">{row.asset_name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.asset_tag}
                  {row.serial_number && ` · S/N ${row.serial_number}`}
                </p>
                {row.exit_clearance_pending && (
                  <Badge variant="warning" className="mt-1">
                    Return before your last day
                  </Badge>
                )}
              </TableCell>
              <TableCell>{row.category_name}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {stampDay(row.assigned_at)}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {row.expected_return_date ? (
                  <span className="flex items-center gap-2">
                    {dayOrDash(row.expected_return_date)}
                    {row.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No return date</span>
                )}
              </TableCell>
              <TableCell>{CONDITION_LABELS[row.condition_out]}</TableCell>
              <TableCell className="text-right">
                {row.acknowledged_at ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-primary" />
                    {stampDay(row.acknowledged_at)}
                  </span>
                ) : row.requires_acknowledgement ? (
                  <Button
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void acknowledge(row)}
                  >
                    {busyId === row.id && <Loader2 className="animate-spin" />}
                    Acknowledge
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Not needed</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestsTable({ rows, onChanged }: { rows: AssetRequest[]; onChanged: () => void }) {
  const [withdrawing, setWithdrawing] = useState<AssetRequest | null>(null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asked for</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Needed by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium text-foreground">{row.category_name}</p>
                <p className="text-xs text-muted-foreground">Asked {stampDay(row.created_at)}</p>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal text-sm">{row.reason}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {dayOrDash(row.needed_by)}
              </TableCell>
              <TableCell>
                <RequestStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal text-sm text-muted-foreground">
                {row.status === "fulfilled" && row.fulfilled_asset_tag
                  ? `Handed over ${row.fulfilled_asset_tag} on ${stampDay(row.fulfilled_at)}`
                  : row.decided_by_name
                    ? `${row.decided_by_name}${row.decision_note ? `: ${row.decision_note}` : ""}`
                    : "—"}
              </TableCell>
              <TableCell className="text-right">
                {row.can_cancel && (
                  <Button variant="ghost" size="sm" onClick={() => setWithdrawing(row)}>
                    Withdraw
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Withdraw this request?"
        description={
          withdrawing
            ? `Your request for a ${withdrawing.category_name} will be closed. You can ask again later.`
            : undefined
        }
        confirmLabel="Withdraw"
        destructive
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            await post<AssetRequest>(`/assets/requests/${withdrawing.id}/cancel`);
            toast.success("Request withdrawn");
            onChanged();
          } catch (caught) {
            toastApiError(caught, "The request could not be withdrawn.");
            throw caught;
          }
        }}
      />
    </div>
  );
}

function HistoryTable({ rows }: { rows: AssetAssignment[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Held</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Condition back</TableHead>
            <TableHead className="text-right">Recovered</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium text-foreground">{row.asset_name}</p>
                <p className="text-xs text-muted-foreground">{row.asset_tag}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {stampDay(row.assigned_at)} – {stampDay(row.closed_at)}
              </TableCell>
              <TableCell>
                <OutcomeBadge outcome={row.outcome} />
              </TableCell>
              <TableCell>{row.condition_in ? CONDITION_LABELS[row.condition_in] : "—"}</TableCell>
              <TableCell className="text-right">
                {row.recovery_amount ? <Money value={row.recovery_amount} /> : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

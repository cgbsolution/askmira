"use client";

import { Coins, Gift, Hourglass, Loader2, Receipt, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { AwardPointsResult, LedgerType, RewardStatement } from "@/lib/types/rewards";
import { formatDate, formatDateTime } from "@/lib/utils";

const LEDGER: Record<LedgerType, { label: string; variant: "success" | "secondary" | "muted" | "outline" | "warning" }> = {
  awarded: { label: "Awarded", variant: "success" },
  redeemed: { label: "Redeemed", variant: "secondary" },
  expired: { label: "Expired", variant: "muted" },
  adjusted: { label: "Adjusted", variant: "outline" },
  reversed: { label: "Reversed", variant: "warning" },
};

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Rewards → My points.
 *
 * A points balance is money the company owes, so it is shown in rupees beside
 * the points, with the lots that are about to expire and the tax position for
 * the year — points above the exemption threshold are a taxable perquisite,
 * and a person should learn that here, not on their Form 16.
 */
export function MyPointsScreen() {
  const { user, hasRole } = useAuth();
  const canAward = hasRole("tenant_admin", "hr_admin", "hr_ops", "manager");
  const statement = useApiQuery<RewardStatement>(user?.employee_id ? "/rewards/me/statement" : null);
  const [redeeming, setRedeeming] = useState(false);
  const [awarding, setAwarding] = useState(false);

  const data = statement.data;

  return (
    <PageShell
      tier="tier2"
      title="My points"
      description="What you have been given, what it is worth, and when it expires."
      actions={
        <>
          {canAward && (
            <Button variant="outline" onClick={() => setAwarding(true)}>
              <Sparkles /> Award points
            </Button>
          )}
          {data && data.balance_points > 0 && (
            <Button onClick={() => setRedeeming(true)}>
              <Gift /> Redeem
            </Button>
          )}
        </>
      }
    >
      <SectionNav section="rewards" />

      {!user?.employee_id ? (
        <Alert>
          <AlertTitle>Your login is not linked to an employee record</AlertTitle>
          <AlertDescription>Points belong to an employee record. Ask HR to link your login.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Coins} label="Balance" value={data ? data.balance_points.toLocaleString("en-IN") : "—"} sub={data ? <Money value={data.balance_rupees} /> : null} />
            <Metric
              icon={Hourglass}
              label="Expiring soon"
              value={data ? data.expiring.reduce((sum, lot) => sum + lot.points, 0).toLocaleString("en-IN") : "—"}
              sub={data && data.expiring[0] ? `first on ${formatDate(data.expiring[0].expires_on)}` : "nothing due"}
            />
            <Metric
              icon={Receipt}
              label={`Taxable this year (${data?.tax.financial_year ?? "—"})`}
              value={data ? <Money value={data.tax.taxable_value} /> : "—"}
              sub={data ? <>of <Money value={data.tax.total_value} /> received</> : null}
            />
          </div>

          {data?.expiry_disclosure && <p className="text-xs text-muted-foreground">{data.expiry_disclosure}</p>}

          {data && data.tax.any_provisional && (
            <Alert variant="warning">
              <AlertTitle>Tax treatment is provisional</AlertTitle>
              <AlertDescription>{data.tax.note}</AlertDescription>
            </Alert>
          )}

          {data && data.expiring.length > 0 && (
            <DataPanel tier="tier2" title="Expiring points">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Awarded</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Worth</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expiring.map((lot, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm">{formatDate(lot.awarded_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{lot.points}</TableCell>
                      <TableCell className="text-right">
                        <Money value={lot.rupees} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(lot.expires_on)}
                        <span className="ml-1 text-xs text-muted-foreground">({lot.days_left} days)</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataPanel>
          )}

          <DataPanel
            tier="tier2"
            title="Statement"
            isLoading={statement.isLoading}
            error={statement.error?.detail ?? null}
            onRetry={statement.reload}
            isEmpty={(data?.rows ?? []).length === 0}
            empty={{ icon: Coins, title: "No points yet", description: "Points come with recognition from your manager or peers." }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Worth</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows ?? []).map((row) => (
                  <TableRow key={row.entry_id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.occurred_at)}</TableCell>
                    <TableCell>
                      <Badge variant={LEDGER[row.type].variant}>{LEDGER[row.type].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.points > 0 ? `+${row.points}` : row.points}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={row.value} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.balance_after}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </>
      )}

      <RedeemDialog
        open={redeeming}
        balance={data?.balance_points ?? 0}
        onOpenChange={setRedeeming}
        onDone={statement.reload}
      />
      <AwardDialog open={awarding} onOpenChange={setAwarding} />
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Coins;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <Card tier="tier2" className="py-4">
      <CardContent className="flex items-start gap-3 px-4">
        <Icon className="mt-1 size-4 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function RedeemDialog({
  open,
  balance,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  balance: number;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPoints("");
      setDescription("");
      setSku("");
    }
  }, [open]);

  const amount = Number(points);
  const invalid = !Number.isInteger(amount) || amount <= 0 || amount > balance || !description.trim();

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/rewards/redemptions", {
        points: amount,
        item_description: description.trim(),
        item_sku: sku.trim() || null,
      });
      toast.success("Redemption requested. HR orders it from the partner.");
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not redeem."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redeem points</DialogTitle>
          <DialogDescription>
            You have {balance.toLocaleString("en-IN")} points. The oldest are spent first, so the ones closest to
            expiring go first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="redeem-points" label="Points" error={amount > balance ? "More than your balance." : undefined}>
            <Input id="redeem-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="redeem-description" label="What you would like">
            <Textarea id="redeem-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Amazon voucher, ₹2,000" />
          </FormField>
          <FormField htmlFor="redeem-sku" label="Catalogue code" optional>
            <Input id="redeem-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Redeem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Managers and HR award points; never to themselves, and against a budget where one is set. */
function AwardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [points, setPoints] = useState("");
  const [result, setResult] = useState<AwardPointsResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPerson(null);
      setPoints("");
      setResult(null);
    }
  }, [open]);

  const amount = Number(points);

  const submit = async () => {
    if (!person) return;
    setIsBusy(true);
    try {
      const outcome = await post<AwardPointsResult>("/rewards/awards", { employee_id: person.id, points: amount });
      setResult(outcome);
      toast.success(`${amount} points awarded to ${person.label}.`);
    } catch (caught) {
      toast.error(detail(caught, "Could not award points."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Award points</DialogTitle>
          <DialogDescription>Points carry a rupee value and, above the yearly threshold, a tax cost for the recipient.</DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <Alert variant={result.budget.permitted ? "success" : "warning"}>
              <AlertTitle>
                Worth <Money value={result.monetary_value} />; their balance is now {result.balance_after}.
              </AlertTitle>
              <AlertDescription>{result.budget.message}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-4">
              <FormField htmlFor="award-person" label="Who">
                <EmployeePicker id="award-person" value={person} onChange={setPerson} excludeId={user?.employee_id} />
              </FormField>
              <FormField htmlFor="award-points" label="Points">
                <Input id="award-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} />
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={isBusy || !person || !(amount > 0)}>
                {isBusy && <Loader2 className="animate-spin" />} Award
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

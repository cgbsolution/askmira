"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiErrorMessage, InlineProblem, isMoneyInput, isZero } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { HouseRent, HouseRentInput } from "@/lib/types/tax";

import {
  financialYearMonths,
  monthLabel,
  pendingState,
  ProofStatusBadge,
  startYearOf,
  useHasLoaded,
} from "./common";
import { FieldLegend, FieldSet } from "@/components/ui/field";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Rent paid, month by month, April to March. The HRA exemption is worked out
 * from it. Whether the landlord's PAN is needed depends on a threshold in the
 * payroll rules; the server enforces it and says what the threshold is.
 */
export function HouseRentPanel({
  financialYear,
  onChanged,
}: {
  financialYear: string;
  onChanged: () => void;
}) {
  const months = useMemo(() => financialYearMonths(startYearOf(financialYear)), [financialYear]);
  const query = useApiQuery<HouseRent | null>(
    `/tax/house-rent?financial_year=${encodeURIComponent(financialYear)}`,
  );
  const loaded = useHasLoaded(query);

  const [rents, setRents] = useState<string[]>(() => Array.from({ length: 12 }, () => ""));
  const [sameRent, setSameRent] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordPan, setLandlordPan] = useState("");
  const [address, setAddress] = useState("");
  const [isMetro, setIsMetro] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fill the form once from what is on record.
  useEffect(() => {
    if (hydrated || !loaded) return;
    const record = query.data;
    if (record) {
      setRents(
        months.map(
          (slot) =>
            record.monthly_rent.find((row) => row.month === slot.month && row.year === slot.year)
              ?.rent ?? "",
        ),
      );
      setLandlordName(record.landlord_name ?? "");
      setLandlordPan(record.landlord_pan ?? "");
      setAddress(record.property_address ?? "");
      setIsMetro(record.is_metro);
    }
    setHydrated(true);
  }, [hydrated, loaded, query.data, months]);

  const state = pendingState(query, { rows: 6, loaded });

  const rentErrors = rents.map((rent) =>
    rent.trim() && !isMoneyInput(rent) ? "Rupees, at most two decimals" : null,
  );
  const noRent = rents.every((rent) => !rent.trim() || (isMoneyInput(rent) && isZero(rent)));
  const panError =
    landlordPan.trim() && !PAN_PATTERN.test(landlordPan.trim())
      ? "A PAN is five letters, four digits and a letter, like ABCDE1234F."
      : null;
  const sameRentError = sameRent.trim() && !isMoneyInput(sameRent) ? "Rupees, at most two decimals." : null;

  const save = async () => {
    setAttempted(true);
    if (rentErrors.some(Boolean) || noRent || panError) return;
    setIsSaving(true);
    setServerError(null);
    const body: HouseRentInput = {
      financial_year: financialYear,
      monthly_rent: months.map((slot, index) => ({
        month: slot.month,
        year: slot.year,
        rent: rents[index].trim() || "0",
      })),
      landlord_name: landlordName.trim() || null,
      landlord_pan: landlordPan.trim().toUpperCase() || null,
      property_address: address.trim() || null,
      is_metro: isMetro,
    };
    try {
      await put<HouseRent>("/tax/house-rent", body);
      toast.success("Rent saved", { description: "The projection has been refreshed." });
      query.reload();
      onChanged();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The rent could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const record = query.data ?? null;

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>House rent</CardTitle>
        <CardDescription>
          Rent you pay in FY {financialYear}. Your HRA exemption is worked out from it — the
          Projection tab shows which limit applies.
        </CardDescription>
        {record && (
          <CardAction>
            <ProofStatusBadge status={record.status} />
          </CardAction>
        )}
      </CardHeader>

      {state ? (
        <CardContent className="p-0">{state}</CardContent>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-5"
        >
          <CardContent className="space-y-5">
            {record ? (
              <p className="text-sm text-muted-foreground">
                Annual rent on record: <Money value={record.annual_rent} className="font-semibold text-foreground" />
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No rent is recorded for FY {financialYear} yet.
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <FormField htmlFor="rent-same" label="Same rent every month (₹)" error={sameRentError}>
                <Input
                  id="rent-same"
                  value={sameRent}
                  inputMode="decimal"
                  className="w-44 tabular-nums"
                  autoComplete="off"
                  aria-invalid={Boolean(sameRentError)}
                  onChange={(event) => setSameRent(event.target.value)}
                />
              </FormField>
              <Button
                type="button"
                variant="outline"
                disabled={!sameRent.trim() || Boolean(sameRentError)}
                onClick={() => setRents(months.map(() => sameRent.trim()))}
              >
                Fill all twelve months
              </Button>
            </div>

            <FieldSet className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <FieldLegend className="sr-only">Monthly rent</FieldLegend>
              {months.map((slot, index) => {
                const id = `rent-${slot.year}-${slot.month}`;
                return (
                  <FormField
                    key={id}
                    htmlFor={id}
                    label={monthLabel(slot.month, slot.year)}
                    error={rentErrors[index]}
                  >
                    <Input
                      id={id}
                      value={rents[index]}
                      inputMode="decimal"
                      placeholder="0"
                      autoComplete="off"
                      className="tabular-nums"
                      aria-invalid={Boolean(rentErrors[index])}
                      onChange={(event) =>
                        setRents((current) =>
                          current.map((value, i) => (i === index ? event.target.value : value)),
                        )
                      }
                    />
                  </FormField>
                );
              })}
            </FieldSet>
            {attempted && noRent && (
              <p className="text-xs text-destructive">Enter the rent for at least one month.</p>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="rent-landlord-name" label="Landlord's name" optional>
                <Input
                  id="rent-landlord-name"
                  value={landlordName}
                  maxLength={255}
                  onChange={(event) => setLandlordName(event.target.value)}
                />
              </FormField>
              <FormField
                htmlFor="rent-landlord-pan"
                label="Landlord's PAN"
                hint="Required when annual rent is above the limit in your employer's payroll rules. You will be told the limit if it applies."
                error={panError}
              >
                <Input
                  id="rent-landlord-pan"
                  value={landlordPan}
                  maxLength={10}
                  autoComplete="off"
                  className="uppercase tabular-nums"
                  aria-invalid={Boolean(panError)}
                  onChange={(event) => setLandlordPan(event.target.value.toUpperCase().trim())}
                />
              </FormField>
              <FormField
                htmlFor="rent-address"
                label="Address of the rented home"
                optional
                className="md:col-span-2"
              >
                <Textarea
                  id="rent-address"
                  value={address}
                  rows={2}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="rent-metro">The rented home is in a metro city</Label>
                <p className="text-xs text-muted-foreground">
                  Changes the share of basic salary used as one of the HRA limits.
                </p>
              </div>
              <Switch id="rent-metro" checked={isMetro} onCheckedChange={setIsMetro} />
            </div>

            {serverError && <InlineProblem>{serverError}</InlineProblem>}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={isSaving || !hydrated}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save rent
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

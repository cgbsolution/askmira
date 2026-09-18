"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { patch, post } from "@/lib/api";
import type { LegalEntity } from "@/lib/types/people";

import { errorDetail } from "./settingsShared";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const TAN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z0-9]{13}$/;
const CODE = /^[A-Za-z0-9_-]+$/;

interface Values {
  name: string;
  code: string;
  pan: string;
  tan: string;
  gstin: string;
  pf_registration_no: string;
  esi_registration_no: string;
  registered_address: string;
  is_active: boolean;
}

const EMPTY: Values = {
  name: "",
  code: "",
  pan: "",
  tan: "",
  gstin: "",
  pf_registration_no: "",
  esi_registration_no: "",
  registered_address: "",
  is_active: true,
};

/**
 * Create or edit a legal entity.
 *
 * The identifier formats are checked here as well as on the API — not because
 * the client is trusted, but because a PAN typed one character short should be
 * caught while the person still has the document in front of them, rather than
 * at the moment a quarterly return is generated.
 */
export function LegalEntityDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: LegalEntity | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            pan: editing.pan ?? "",
            tan: editing.tan ?? "",
            gstin: editing.gstin ?? "",
            pf_registration_no: editing.pf_registration_no ?? "",
            esi_registration_no: editing.esi_registration_no ?? "",
            registered_address: editing.registered_address ?? "",
            is_active: editing.is_active,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (values.name.trim().length < 1) errors.name = "A name is required.";
  if (!CODE.test(values.code.trim()))
    errors.code = "Letters, digits, hyphen and underscore only.";
  if (values.pan && !PAN.test(values.pan.toUpperCase()))
    errors.pan = "A PAN is five letters, four digits, then a letter.";
  if (values.tan && !TAN.test(values.tan.toUpperCase()))
    errors.tan = "A TAN is four letters, five digits, then a letter.";
  if (values.gstin && !GSTIN.test(values.gstin.toUpperCase()))
    errors.gstin = "A GSTIN is two digits then thirteen letters or digits.";
  const invalid = Object.keys(errors).length > 0;

  const submit = async () => {
    setIsBusy(true);
    const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());
    const body = {
      name: values.name.trim(),
      code: values.code.trim(),
      pan: blankToNull(values.pan.toUpperCase()),
      tan: blankToNull(values.tan.toUpperCase()),
      gstin: blankToNull(values.gstin.toUpperCase()),
      pf_registration_no: blankToNull(values.pf_registration_no),
      esi_registration_no: blankToNull(values.esi_registration_no),
      registered_address: blankToNull(values.registered_address),
    };
    try {
      if (editing) {
        await patch(`/org/legal-entities/${editing.id}`, {
          ...body,
          is_active: values.is_active,
        });
        toast.success("Entity updated.");
      } else {
        await post("/org/legal-entities", body);
        toast.success("Entity created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the entity."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a legal entity"}</DialogTitle>
          <DialogDescription>
            Statutory returns are filed per entity, under these registration numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="entity-name" label="Registered name" error={errors.name}>
            <Input
              id="entity-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Acme Technologies Private Limited"
            />
          </FormField>
          <FormField
            htmlFor="entity-code"
            label="Short code"
            error={errors.code}
            hint="Used on filings and file names."
          >
            <Input
              id="entity-code"
              value={values.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="ACME"
              className="font-mono"
            />
          </FormField>

          <FormField htmlFor="entity-pan" label="PAN" optional error={errors.pan}>
            <Input
              id="entity-pan"
              value={values.pan}
              onChange={(event) => set("pan", event.target.value.toUpperCase())}
              placeholder="AAACA1234A"
              className="font-mono uppercase"
              maxLength={10}
            />
          </FormField>
          <FormField
            htmlFor="entity-tan"
            label="TAN"
            optional
            error={errors.tan}
            hint="Required for the quarterly TDS return (24Q)."
          >
            <Input
              id="entity-tan"
              value={values.tan}
              onChange={(event) => set("tan", event.target.value.toUpperCase())}
              placeholder="BLRA12345B"
              className="font-mono uppercase"
              maxLength={10}
            />
          </FormField>

          <FormField
            htmlFor="entity-pf"
            label="PF registration number"
            optional
            hint="Required for the monthly ECR."
          >
            <Input
              id="entity-pf"
              value={values.pf_registration_no}
              onChange={(event) => set("pf_registration_no", event.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField htmlFor="entity-esi" label="ESI registration number" optional>
            <Input
              id="entity-esi"
              value={values.esi_registration_no}
              onChange={(event) => set("esi_registration_no", event.target.value)}
              className="font-mono"
            />
          </FormField>

          <FormField
            htmlFor="entity-gstin"
            label="GSTIN"
            optional
            error={errors.gstin}
            hint="Used when claiming input credit on expense invoices."
          >
            <Input
              id="entity-gstin"
              value={values.gstin}
              onChange={(event) => set("gstin", event.target.value.toUpperCase())}
              placeholder="29AAACA1234A1Z5"
              className="font-mono uppercase"
              maxLength={15}
            />
          </FormField>

          <FormField
            htmlFor="entity-address"
            label="Registered address"
            optional
            className="sm:col-span-2"
          >
            <Textarea
              id="entity-address"
              value={values.registered_address}
              onChange={(event) => set("registered_address", event.target.value)}
              rows={2}
            />
          </FormField>

          {editing && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="entity-active"
                checked={values.is_active}
                onCheckedChange={(next) => set("is_active", next)}
              />
              <Label htmlFor="entity-active" className="text-sm font-normal">
                Active. An inactive entity stays on historical filings but cannot be chosen for
                new ones.
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create entity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { patch, post } from "@/lib/api";
import { INDIAN_STATES, stateName } from "@/lib/states";
import type { LegalEntity, Location } from "@/lib/types/people";

import { errorDetail } from "./settingsShared";

const CODE = /^[A-Za-z0-9_-]+$/;
const PINCODE = /^[1-9][0-9]{5}$/;

/** The timezones a workspace realistically operates in. Anything else is typed. */
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];

interface Values {
  legal_entity_id: string;
  name: string;
  code: string;
  city: string;
  state_code: string;
  pincode: string;
  timezone: string;
  is_active: boolean;
}

const EMPTY: Values = {
  legal_entity_id: "",
  name: "",
  code: "",
  city: "",
  state_code: "KA",
  pincode: "",
  timezone: "Asia/Kolkata",
  is_active: true,
};

/**
 * Create or edit a work location.
 *
 * The state is the consequential field: professional tax, labour welfare fund
 * and the holiday list all follow it. Changing it on an existing location
 * therefore says so before it is saved, rather than surfacing as a different
 * deduction on next month's payslip.
 */
export function LocationDialog({
  open,
  editing,
  entities,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: Location | null;
  entities: LegalEntity[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const active = entities.filter((entity) => entity.is_active);
    setValues(
      editing
        ? {
            legal_entity_id: editing.legal_entity_id,
            name: editing.name,
            code: editing.code,
            city: editing.city ?? "",
            state_code: editing.state_code,
            pincode: editing.pincode ?? "",
            timezone: editing.timezone,
            is_active: editing.is_active,
          }
        : { ...EMPTY, legal_entity_id: active[0]?.id ?? "" },
    );
  }, [open, editing, entities]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (!values.legal_entity_id) errors.legal_entity_id = "Every location belongs to an entity.";
  if (values.name.trim().length < 1) errors.name = "A name is required.";
  if (!CODE.test(values.code.trim()))
    errors.code = "Letters, digits, hyphen and underscore only.";
  if (values.pincode && !PINCODE.test(values.pincode))
    errors.pincode = "Six digits, not starting with zero.";
  const invalid = Object.keys(errors).length > 0;

  const stateChanged = editing !== null && editing.state_code !== values.state_code;

  const submit = async () => {
    setIsBusy(true);
    const body = {
      legal_entity_id: values.legal_entity_id,
      name: values.name.trim(),
      code: values.code.trim(),
      city: values.city.trim() || null,
      state_code: values.state_code,
      pincode: values.pincode.trim() || null,
      timezone: values.timezone,
    };
    try {
      if (editing) {
        await patch(`/org/locations/${editing.id}`, { ...body, is_active: values.is_active });
        toast.success("Location updated.");
      } else {
        await post("/org/locations", body);
        toast.success("Location created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the location."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a work location"}</DialogTitle>
          <DialogDescription>
            An employee&apos;s location decides which entity they are paid by and which
            state&apos;s rules apply to them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="location-entity"
            label="Legal entity"
            error={errors.legal_entity_id}
            className="sm:col-span-2"
          >
            <Select
              value={values.legal_entity_id}
              onValueChange={(next) => set("legal_entity_id", next)}
            >
              <SelectTrigger id="location-entity" className="w-full">
                <SelectValue placeholder="Choose an entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id} disabled={!entity.is_active}>
                    {entity.name}
                    {!entity.is_active && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="location-name" label="Location name" error={errors.name}>
            <Input
              id="location-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Bengaluru — Whitefield"
            />
          </FormField>
          <FormField htmlFor="location-code" label="Short code" error={errors.code}>
            <Input
              id="location-code"
              value={values.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="BLR-WF"
              className="font-mono"
            />
          </FormField>

          <FormField htmlFor="location-state" label="State or union territory">
            <Select value={values.state_code} onValueChange={(next) => set("state_code", next)}>
              <SelectTrigger id="location-state" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="location-city" label="City" optional>
            <Input
              id="location-city"
              value={values.city}
              onChange={(event) => set("city", event.target.value)}
              placeholder="Bengaluru"
            />
          </FormField>

          <FormField htmlFor="location-pincode" label="PIN code" optional error={errors.pincode}>
            <Input
              id="location-pincode"
              value={values.pincode}
              onChange={(event) => set("pincode", event.target.value)}
              placeholder="560066"
              className="font-mono"
              maxLength={6}
            />
          </FormField>
          <FormField
            htmlFor="location-timezone"
            label="Timezone"
            hint="Attendance punches are judged against shift times in this zone."
          >
            <Select value={values.timezone} onValueChange={(next) => set("timezone", next)}>
              <SelectTrigger id="location-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {stateChanged && (
            <Alert className="sm:col-span-2">
              <TriangleAlert />
              <AlertTitle>
                Moving this location from {stateName(editing.state_code)} to{" "}
                {stateName(values.state_code)}
              </AlertTitle>
              <AlertDescription>
                Everyone at this location will be assessed under the new state&apos;s professional
                tax slabs and labour welfare fund months from the next payroll run, and the holiday
                list changes with it. Payroll already run is untouched.
              </AlertDescription>
            </Alert>
          )}

          {editing && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="location-active"
                checked={values.is_active}
                onCheckedChange={(next) => set("is_active", next)}
              />
              <Label htmlFor="location-active" className="text-sm font-normal">
                Active. An inactive location cannot be assigned to new employees.
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
            {editing ? "Save changes" : "Create location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

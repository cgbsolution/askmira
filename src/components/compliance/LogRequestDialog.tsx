"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import { REQUEST_TYPE_LABEL, type RequestType } from "@/lib/types/dpdp";
import { formatDate } from "@/lib/utils";

type RequesterKind = "employee" | "candidate" | "dependent" | "emergency_contact";

const REQUESTER_LABEL: Record<RequesterKind, string> = {
  employee: "An employee",
  candidate: "A job candidate",
  dependent: "A nominee or family member",
  emergency_contact: "An emergency contact",
};

interface CandidateOption {
  id: string;
  full_name: string;
  email: string;
  requisition_code: string | null;
}

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Compliance → Data protection → Log a request.
 *
 * For a request that arrived off-platform — by email, post or to the DPO — from
 * anyone the workspace holds data about: an employee, a job candidate, or a
 * nominee, family member or emergency contact whose details sit inside an
 * employee's record. The statutory clock starts when it is logged.
 */
export function LogRequestDialog({
  open,
  onOpenChange,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}) {
  const [kind, setKind] = useState<RequesterKind>("employee");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [candidate, setCandidate] = useState<CandidateOption | null>(null);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [personName, setPersonName] = useState("");
  const [contact, setContact] = useState("");
  const [type, setType] = useState<RequestType>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind("employee");
    setEmployee(null);
    setCandidate(null);
    setSearch("");
    setCandidates([]);
    setPersonName("");
    setContact("");
    setType("access");
    setDetails("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || kind !== "candidate" || candidate) return;
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page_size: "10" });
      if (search.trim()) params.set("search", search.trim());
      get<Page<CandidateOption>>(`/hiring/candidates?${params}`)
        .then((page) => !cancelled && setCandidates(page.items))
        .catch(() => !cancelled && setCandidates([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, kind, search, candidate]);

  const inRecord = kind === "dependent" || kind === "emergency_contact";
  const needsDetails = type === "correction" || type === "grievance" || type === "nomination" || inRecord;

  const ready =
    (kind === "employee" && employee !== null) ||
    (kind === "candidate" && candidate !== null) ||
    (inRecord && employee !== null && personName.trim().length >= 2);

  const submit = async () => {
    if (!ready || busy) return;
    if (needsDetails && !details.trim()) {
      setError("Say what the person asked for.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (kind === "employee" && employee) {
        body = {
          principal_id: employee.id,
          principal_kind: "employee",
          principal_label: `${employeeDisplayName(employee)} (${employee.employee_code})`,
          principal_contact: contact.trim() || employee.work_email,
        };
      } else if (kind === "candidate" && candidate) {
        body = {
          principal_id: candidate.id,
          principal_kind: "candidate",
          principal_label: candidate.full_name,
          principal_contact: contact.trim() || candidate.email,
        };
      } else {
        // Their own id: they have no record, and the request must not appear
        // in the employee's own list of requests.
        body = {
          principal_id: crypto.randomUUID(),
          principal_kind: kind,
          principal_label: personName.trim(),
          principal_contact: contact.trim() || null,
        };
      }
      const recordNote =
        inRecord && employee
          ? `Held in the record of ${employeeDisplayName(employee)} (${employee.employee_code}). `
          : "";
      const result = await post<{ due_by: string }>("/dpdp/requests", {
        ...body,
        request_type: type,
        details: `${recordNote}${details.trim()}`.trim() || null,
      });
      toast.success(`Logged. The answer is due by ${formatDate(result.due_by)}.`);
      onLogged();
      onOpenChange(false);
    } catch (caught) {
      setError(detail(caught, "The request was not logged."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a privacy request</DialogTitle>
          <DialogDescription>
            For a request that came by email, post or to your privacy contact. The answer clock starts now.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="log-kind" label="Who is asking">
            <Select
              value={kind}
              onValueChange={(next) => {
                setKind(next as RequesterKind);
                setEmployee(null);
                setCandidate(null);
                setError(null);
              }}
            >
              <SelectTrigger id="log-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REQUESTER_LABEL) as RequesterKind[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REQUESTER_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {(kind === "employee" || inRecord) && (
            <FormField
              htmlFor="log-employee"
              label={inRecord ? "Whose record they are in" : "Employee"}
              hint={inRecord ? "Their request is answered by showing or correcting that record." : undefined}
            >
              <EmployeePicker id="log-employee" value={employee} onChange={setEmployee} excludeId={null} />
            </FormField>
          )}

          {inRecord && (
            <FormField htmlFor="log-person" label="Their name">
              <Input id="log-person" value={personName} maxLength={200} onChange={(e) => setPersonName(e.target.value)} />
            </FormField>
          )}

          {kind === "candidate" && (
            <FormField htmlFor="log-candidate" label="Candidate">
              {candidate ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    {candidate.full_name} <span className="text-muted-foreground">· {candidate.email}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setCandidate(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="log-candidate"
                      className="pl-8"
                      placeholder="Search by name or email"
                      value={search}
                      maxLength={80}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    {searching ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Searching…
                      </div>
                    ) : candidates.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No candidates found.</p>
                    ) : (
                      candidates.map((option) => (
                        <Button
                          type="button"
                          variant="ghost"
                          key={option.id}
                          onClick={() => setCandidate(option)}
                          className="h-auto w-full flex-col items-start gap-0 rounded-none px-3 py-2 text-left font-normal"
                        >
                          <span className="font-medium text-foreground">{option.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.email}
                            {option.requisition_code && ` · ${option.requisition_code}`}
                          </span>
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </FormField>
          )}

          <FormField htmlFor="log-contact" label="How to reach them" optional>
            <Input id="log-contact" value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)} />
          </FormField>

          <FormField htmlFor="log-type" label="What they asked for">
            <Select value={type} onValueChange={(next) => setType(next as RequestType)}>
              <SelectTrigger id="log-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REQUEST_TYPE_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="log-details" label="Details" optional={!needsDetails} error={error ?? undefined}>
            <Textarea id="log-details" rows={3} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || busy}>
            {busy && <Loader2 className="animate-spin" />} Log request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

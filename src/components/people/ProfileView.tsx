"use client";

import { ArrowLeft, CalendarClock, Pencil, UserMinus, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { DocumentsPanel } from "@/components/docs/DocumentsPanel";
import { LettersPanel } from "@/components/docs/LettersPanel";
import { CompensationPanel } from "@/components/people/CompensationPanel";
import { ContactDetailsDialog } from "@/components/people/ContactDetailsDialog";
import { EmployeeForm } from "@/components/people/EmployeeForm";
import {
  EMPLOYMENT_TYPE,
  GENDER,
  apiMessage,
  personName,
} from "@/components/people/labels";
import { LifecycleTimeline } from "@/components/people/LifecycleTimeline";
import { DetailItem, EmploymentStatusBadge } from "@/components/people/StatusBadges";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del } from "@/lib/api";
import type { EmployeeRecord } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

function day(value: string | null): string | null {
  return value ? formatDay(value, true) : null;
}

/**
 * One person's profile. What shows depends on who is looking — and the API has
 * already decided what came back: personal fields only for the person and HR,
 * pay only for them, lifecycle history for HR and the reporting line.
 */
export function ProfileView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasRole, hasModule } = useAuth();
  const org = useOrgReference();
  const record = useApiQuery<EmployeeRecord>(`/employees/${id}`);
  const employee = record.data;
  const manager = useApiQuery<EmployeeRecord>(
    employee?.manager_id ? `/employees/${employee.manager_id}` : null,
  );
  const [editing, setEditing] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const isSelf = Boolean(employee && employee.id === user?.employee_id);
  const seesPrivate = isSelf || isHr;
  const seesHistory = isHr || hasRole("manager");
  const seesPay = seesPrivate && hasModule("payroll");

  const shell = (children: React.ReactNode) => (
    <PageShell title="Employee profile">
      {children}
    </PageShell>
  );

  if (record.isLoading && !employee) {
    return shell(<Skeleton className="h-72 w-full" />);
  }
  if (record.error) {
    return shell(
      <Card tier="tier1">
        {record.error.status === 404 ? (
          <EmptyState
            icon={UserRound}
            title="This person is not in your workspace"
            action={
              <Button variant="outline" asChild>
                <Link href="/people">Back to the directory</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={record.error.detail} onRetry={record.reload} />
        )}
      </Card>,
    );
  }
  if (!employee) return shell(null);

  const name = personName(employee);
  const picked = { id: employee.id, label: `${name} (${employee.employee_code})` };

  const deactivate = async () => {
    try {
      await del(`/employees/${employee.id}`);
      toast.success(`${employee.employee_code} deactivated`);
      router.push("/people");
    } catch (error) {
      toast.error(apiMessage(error, "The employee could not be deactivated."));
      throw error;
    }
  };

  return (
    <PageShell
      title={name}
      description={[employee.designation, org.departmentName(employee.department_id)]
        .filter((part) => part && part !== "—")
        .join(" · ")}
      actions={
        <>
          <Button variant="ghost" asChild>
            <Link href="/people">
              <ArrowLeft /> Directory
            </Link>
          </Button>
          {isSelf && (
            <Button variant="outline" onClick={() => setEditingContact(true)}>
              <Pencil /> Edit contact details
            </Button>
          )}
          {isHr && !isSelf && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/people/lifecycle?employee=${employee.id}`}>
                  <CalendarClock /> Raise event
                </Link>
              </Button>
              <Button onClick={() => setEditing(true)}>
                <Pencil /> Edit record
              </Button>
            </>
          )}
          {isAdmin && !isSelf && employee.is_active && (
            <Button variant="destructive" onClick={() => setDeactivating(true)}>
              <UserMinus /> Deactivate
            </Button>
          )}
        </>
      }
    >
      <Card tier="tier1">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <PersonCell
            size="lg"
            name={name}
            photoUrl={employee.photo_url}
            subtitle={`${employee.employee_code} · ${employee.work_email}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <EmploymentStatusBadge status={employee.status} />
            {!employee.is_active && <Badge variant="destructive">Deactivated</Badge>}
            {isSelf && <Badge variant="secondary">This is you</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {seesPrivate && <TabsTrigger value="personal">Personal</TabsTrigger>}
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {seesPay && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {seesHistory && !isSelf && <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card tier="tier1">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Designation">{employee.designation}</DetailItem>
              <DetailItem label="Department">{org.departmentName(employee.department_id)}</DetailItem>
              <DetailItem label="Location">{org.locationName(employee.location_id)}</DetailItem>
              <DetailItem label="Manager">
                {employee.manager_id ? (
                  manager.data ? (
                    <Link className="text-primary hover:underline" href={`/people/${manager.data.id}`}>
                      {personName(manager.data)}
                    </Link>
                  ) : manager.isLoading ? (
                    "…"
                  ) : (
                    "Not visible"
                  )
                ) : null}
              </DetailItem>
              <DetailItem label="Work email">{employee.work_email}</DetailItem>
              <DetailItem label="Joined">{day(employee.date_of_joining)}</DetailItem>
            </CardContent>
          </Card>
        </TabsContent>

        {seesPrivate && (
          <TabsContent value="personal" className="mt-4">
            <Card tier="tier1">
              <CardHeader>
                <CardTitle>Personal details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Display name">{employee.display_name}</DetailItem>
                <DetailItem label="Personal email">{employee.personal_email}</DetailItem>
                <DetailItem label="Phone">{employee.phone}</DetailItem>
                <DetailItem label="Date of birth">{day(employee.date_of_birth)}</DetailItem>
                <DetailItem label="Gender">
                  {employee.gender ? GENDER[employee.gender] : null}
                </DetailItem>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="employment" className="mt-4">
          <Card tier="tier1">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Employee code">{employee.employee_code}</DetailItem>
              <DetailItem label="Employment type">{EMPLOYMENT_TYPE[employee.employment_type]}</DetailItem>
              <DetailItem label="Status">
                <EmploymentStatusBadge status={employee.status} />
              </DetailItem>
              <DetailItem label="Legal entity">{org.entityName(employee.legal_entity_id)}</DetailItem>
              <DetailItem label="Grade">{employee.grade ?? (seesPrivate ? null : "Not shown")}</DetailItem>
              <DetailItem label="Date of joining">{day(employee.date_of_joining)}</DetailItem>
              <DetailItem label="Probation ends">{day(employee.probation_end_date)}</DetailItem>
              <DetailItem label="Notice period">
                {employee.notice_period_days !== null ? `${employee.notice_period_days} days` : null}
              </DetailItem>
              <DetailItem label="Date of exit">{day(employee.date_of_exit)}</DetailItem>
            </CardContent>
          </Card>
        </TabsContent>

        {seesPay && (
          <TabsContent value="compensation" className="mt-4">
            <CompensationPanel employeeId={employee.id} />
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="documents" className="mt-4 grid gap-6">
            <DocumentsPanel employee={picked} />
            <LettersPanel employee={picked} />
          </TabsContent>
        )}

        {seesHistory && !isSelf && (
          <TabsContent value="lifecycle" className="mt-4">
            <LifecycleTimeline employeeId={employee.id} />
          </TabsContent>
        )}
      </Tabs>

      {isHr && !isSelf && (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>Edit {name}</SheetTitle>
              <SheetDescription>
                For corrections and set-up. Transfers, promotions and confirmations belong in
                Lifecycle events, where they are approved and dated.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <EmployeeForm
                record={employee}
                onCancel={() => setEditing(false)}
                onSaved={(saved) => {
                  toast.success("Record updated");
                  record.setData(saved);
                  setEditing(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
      {isSelf && (
        <ContactDetailsDialog
          open={editingContact}
          onOpenChange={setEditingContact}
          record={employee}
          onSaved={(saved) => record.setData(saved)}
        />
      )}
      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={`Deactivate ${name}?`}
        description="The record stays for payroll and audit history but leaves the directory. To record a resignation or exit, use People → Exits instead."
        confirmLabel="Deactivate"
        destructive
        onConfirm={deactivate}
      />
    </PageShell>
  );
}

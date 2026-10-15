"use client";

import { ArrowLeft, CalendarClock, Camera, Pencil, UserMinus, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { EmployeeAssetsCard } from "@/components/assets/EmployeeAssetsCard";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { DocumentsPanel } from "@/components/docs/DocumentsPanel";
import { LettersPanel } from "@/components/docs/LettersPanel";
import { CompensationPanel } from "@/components/people/CompensationPanel";
import { CustomFieldsCard } from "@/components/people/CustomFields";
import { CustomTablesSection, useCustomTabs } from "@/components/people/CustomTables";
import { ContactDetailsDialog } from "@/components/people/ContactDetailsDialog";
import { EmployeeForm } from "@/components/people/EmployeeForm";
import { EmployeeTimeline } from "@/components/people/EmployeeTimeline";
import {
  EMPLOYMENT_TYPE,
  GENDER,
  apiMessage,
  personName,
} from "@/components/people/labels";
import { LifecycleTimeline } from "@/components/people/LifecycleTimeline";
import { ChangeRequestsPanel } from "@/components/people/profile/ChangeRequestsPanel";
import { PhotoDialog } from "@/components/people/profile/PhotoDialog";
import {
  AddressesCard,
  BankCard,
  EducationCard,
  EmergencyContactsCard,
  ExperienceCard,
  FamilyCard,
  HiringSnapshotCard,
  IdentityCard,
  MissingAlert,
  NomineesCard,
  PersonalCard,
  StatutoryCard,
} from "@/components/people/profile/ProfileSectionCards";
import { ResignationCard } from "@/components/people/profile/ResignationCard";
import { type EditMode, SectionEditDialog } from "@/components/people/profile/SectionEditDialog";
import { DetailItem, EmploymentStatusBadge } from "@/components/people/StatusBadges";
import { HourlyRatesCard } from "@/components/people/HourlyRatesCard";
import { KioskBadgesCard } from "@/components/people/KioskBadgesCard";
import { TotalRewardsCard } from "@/components/people/TotalRewardsCard";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { BalancesPanel } from "@/components/time/BalancesPanel";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del } from "@/lib/api";
import type { EmployeeProfile, EmployeeRecord, ProfileSection } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";
import { LoginAccessButton } from "./LoginAccessButton";

function day(value: string | null): string | null {
  return value ? formatDay(value, true) : null;
}

/** A tab a host page adds to the profile (My profile adds "Account & security"). */
export interface ExtraTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

/**
 * One person's profile. What shows depends on who is looking — and the API has
 * already decided what came back: personal fields only for the person and HR,
 * identifiers masked for everyone but HR, pay only for them, lifecycle history
 * for HR and the reporting line.
 *
 * Used by the directory (`/people/[id]`) and by My profile (`/profile`, with
 * `recordPath="/employees/me"` and the account tab).
 */
export function ProfileView({
  recordPath,
  title,
  extraTabs = [],
}: {
  /** Defaults to `/employees/{id}` from the route. */
  recordPath?: string;
  title?: string;
  extraTabs?: ExtraTab[];
} = {}) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, hasRole, hasModule } = useAuth();
  const org = useOrgReference();
  const record = useApiQuery<EmployeeRecord>(recordPath ?? `/employees/${params.id}`);
  const employee = record.data;
  const dottedManager = useApiQuery<EmployeeRecord>(
    employee?.dotted_line_manager_id ? `/employees/${employee.dotted_line_manager_id}` : null,
  );
  const manager = useApiQuery<EmployeeRecord>(
    employee?.manager_id ? `/employees/${employee.manager_id}` : null,
  );
  const [editing, setEditing] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [section, setSection] = useState<{ section: ProfileSection; mode: EditMode } | null>(null);
  const [requestsVersion, setRequestsVersion] = useState(0);

  const isHr = hasRole("admin", "sub_admin");
  const isAdmin = hasRole("admin");
  const isSelf = Boolean(employee && employee.id === user?.employee_id);
  const seesPrivate = isSelf || isHr;
  const customTabs = useCustomTabs(Boolean(employee) && (isHr || isSelf));
  // Managing somebody else's team does not open this person's history: the API
  // allows it to HR and to people in this person's own reporting line.
  const seesHistory = isHr || Boolean(employee?.in_your_line);
  const seesPay = seesPrivate && hasModule("payroll");
  // Balances follow the same rule as the history: yourself, HR, your line.
  const seesLeave = (isSelf || seesHistory) && hasModule("leave");

  const profile = useApiQuery<EmployeeProfile>(
    employee && seesPrivate
      ? isSelf
        ? "/employees/me/profile"
        : `/employees/${employee.id}/profile`
      : null,
  );

  const shell = (children: React.ReactNode) => (
    <PageShell title={title ?? "Employee profile"}>
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
  const details = profile.data;

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

  const onEdit = (next: ProfileSection, mode: EditMode) => setSection({ section: next, mode });

  /** A tab's content once the extended profile has loaded. */
  const withProfile = (render: (data: EmployeeProfile) => React.ReactNode) => {
    if (profile.error) {
      return (
        <Card tier="tier1">
          <ErrorState message={profile.error.detail} onRetry={profile.reload} />
        </Card>
      );
    }
    if (!details) return <Skeleton className="h-48 w-full" />;
    return <div className="grid gap-6">{render(details)}</div>;
  };

  return (
    <PageShell
      title={title ?? name}
      description={[employee.designation, org.departmentName(employee.department_id)]
        .filter((part) => part && part !== "—")
        .join(" · ")}
      actions={
        <>
          {!recordPath && (
            <Button variant="ghost" asChild>
              <Link href="/people">
                <ArrowLeft /> Directory
              </Link>
            </Button>
          )}
          {(isSelf || isHr) && (
            <Button variant="outline" onClick={() => setEditingPhoto(true)}>
              <Camera /> {employee.photo_url ? "Change photo" : "Add photo"}
            </Button>
          )}
          {isSelf && (
            <Button variant="outline" onClick={() => setEditingContact(true)}>
              <Pencil /> Edit contact details
            </Button>
          )}
          {isHr && !isSelf && <LoginAccessButton employee={employee} />}
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
            {details && details.pending_requests.length > 0 && (
              <Badge variant="warning">
                {details.pending_requests.length} change
                {details.pending_requests.length === 1 ? "" : "s"} waiting for HR
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {seesPrivate && <TabsTrigger value="personal">Personal</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="family">Family &amp; nominees</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="background">Education &amp; experience</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="statutory">Statutory &amp; bank</TabsTrigger>}
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {seesPay && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {seesPrivate && <TabsTrigger value="requests">Change requests</TabsTrigger>}
          {isSelf && <TabsTrigger value="resignation">Resignation</TabsTrigger>}
          {seesLeave && <TabsTrigger value="leave">Leave</TabsTrigger>}
          {seesHistory && !isSelf && hasModule("leave") && (
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          )}
          {seesHistory && !isSelf && <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>}
          {(seesHistory || isSelf) && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
          {customTabs.map((name) => (
            <TabsTrigger key={`custom:${name}`} value={`custom:${name}`}>
              {name}
            </TabsTrigger>
          ))}
          {extraTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-6">
          {details && <MissingAlert missing={details.missing} />}
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
              {employee.dotted_line_manager_id && (
                <DetailItem label="Dotted-line manager">
                  {dottedManager.data ? (
                    <Link className="text-primary hover:underline" href={`/people/${dottedManager.data.id}`}>
                      {personName(dottedManager.data)}
                    </Link>
                  ) : dottedManager.isLoading ? (
                    "…"
                  ) : (
                    "Not visible"
                  )}
                </DetailItem>
              )}
              <DetailItem label="Work email">{employee.work_email}</DetailItem>
              <DetailItem label="Joined">{day(employee.date_of_joining)}</DetailItem>
            </CardContent>
          </Card>
        </TabsContent>

        {seesPrivate && (
          <TabsContent value="personal" className="mt-4">
            {withProfile((data) => (
              <>
                <IdentityCard profile={data} employee={employee} isSelf={isSelf} onEdit={onEdit} />
                <Card tier="tier1">
                  <CardHeader>
                    <CardTitle className="text-base">Contact details</CardTitle>
                    {isSelf && (
                      <CardAction>
                        <Button size="sm" variant="outline" onClick={() => setEditingContact(true)}>
                          <Pencil /> Edit
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Display name">{employee.display_name}</DetailItem>
                    <DetailItem label="Personal email">{employee.personal_email}</DetailItem>
                    <DetailItem label="Phone">{employee.phone}</DetailItem>
                    <DetailItem label="Gender">
                      {employee.gender ? GENDER[employee.gender] : null}
                    </DetailItem>
                  </CardContent>
                </Card>
                <PersonalCard profile={data} isSelf={isSelf} onEdit={onEdit} />
                <AddressesCard profile={data} isSelf={isSelf} onEdit={onEdit} />
                <EmergencyContactsCard profile={data} isSelf={isSelf} onEdit={onEdit} />
              </>
            ))}
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="family" className="mt-4">
            {withProfile((data) => (
              <>
                <FamilyCard profile={data} isSelf={isSelf} onEdit={onEdit} />
                <NomineesCard profile={data} isSelf={isSelf} onEdit={onEdit} />
              </>
            ))}
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="background" className="mt-4">
            {withProfile((data) => (
              <>
                <EducationCard profile={data} isSelf={isSelf} onEdit={onEdit} />
                <ExperienceCard profile={data} isSelf={isSelf} onEdit={onEdit} />
              </>
            ))}
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="statutory" className="mt-4">
            {withProfile((data) => (
              <>
                <StatutoryCard profile={data} isSelf={isSelf} onEdit={onEdit} />
                <BankCard profile={data} isSelf={isSelf} onEdit={onEdit} />
              </>
            ))}
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
          {(isHr || isSelf) && (
            <div className="mt-6">
              <CustomFieldsCard values={employee.custom_fields ?? {}} />
            </div>
          )}
          {(isHr || isSelf) && (
            <div className="mt-6">
              <CustomTablesSection employeeId={employee.id} />
            </div>
          )}
          {!isSelf && seesHistory && (
            <EmployeeAssetsCard employeeId={employee.id} className="mt-6" />
          )}
          {isHr && !isSelf && details?.hiring_snapshot && Object.keys(details.hiring_snapshot).length > 0 && (
            <div className="mt-6">
              <HiringSnapshotCard snapshot={details.hiring_snapshot} />
            </div>
          )}
        </TabsContent>

        {seesPay && (
          <TabsContent value="compensation" className="mt-4 grid gap-6">
            <TotalRewardsCard employeeId={employee.id} isSelf={isSelf} />
            <CompensationPanel employeeId={employee.id} isSelf={isSelf} />
            {isHr && !isSelf && <HourlyRatesCard employeeId={employee.id} />}
            {isHr && !isSelf && hasModule("leave") && <KioskBadgesCard employeeId={employee.id} />}
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="documents" className="mt-4 grid gap-6">
            <DocumentsPanel employee={picked} />
            <LettersPanel employee={picked} />
          </TabsContent>
        )}

        {seesPrivate && (
          <TabsContent value="requests" className="mt-4">
            <ChangeRequestsPanel
              employeeId={employee.id}
              isSelf={isSelf}
              version={requestsVersion}
              onChanged={profile.reload}
            />
          </TabsContent>
        )}

        {isSelf && (
          <TabsContent value="resignation" className="mt-4">
            <ResignationCard employee={employee} />
          </TabsContent>
        )}

        {seesHistory && !isSelf && hasModule("leave") && (
          <TabsContent value="attendance" className="mt-4">
            <AttendanceCalendar employeeId={employee.id} title={`${name}'s attendance`} />
          </TabsContent>
        )}

        {seesLeave && (
          <TabsContent value="leave" className="mt-4">
            <BalancesPanel
              isHr={isHr}
              ownEmployeeId={user?.employee_id ?? null}
              fixed={{ id: employee.id, name }}
              version={0}
              onChanged={() => undefined}
            />
          </TabsContent>
        )}

        {seesHistory && !isSelf && (
          <TabsContent value="lifecycle" className="mt-4">
            <LifecycleTimeline employeeId={employee.id} />
          </TabsContent>
        )}
        {(seesHistory || isSelf) && (
          <TabsContent value="timeline" className="mt-4">
            <EmployeeTimeline employeeId={employee.id} />
          </TabsContent>
        )}

        {customTabs.map((name) => (
          <TabsContent key={`custom:${name}`} value={`custom:${name}`} className="mt-4 grid gap-6">
            <CustomFieldsCard values={employee.custom_fields ?? {}} tab={name} />
            <CustomTablesSection employeeId={employee.id} tab={name} />
          </TabsContent>
        ))}
        {extraTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>

      {isHr && !isSelf && (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>Edit {name}</SheetTitle>
              <SheetDescription>
                For corrections and set-up. Transfers, promotions and confirmations belong in
                Lifecycle events, where they are approved and dated. Leaving goes through Exits.
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
      {(isSelf || isHr) && (
        <PhotoDialog
          open={editingPhoto}
          onOpenChange={setEditingPhoto}
          employee={employee}
          isSelf={isSelf}
          onSaved={(saved) => record.setData(saved)}
        />
      )}
      {details && (
        <SectionEditDialog
          open={section !== null}
          onOpenChange={(open) => !open && setSection(null)}
          section={section?.section ?? null}
          mode={section?.mode ?? "self-direct"}
          profile={details}
          employee={employee}
          onSaved={(saved) => {
            profile.setData(saved);
            if (section?.section === "identity") record.reload();
          }}
          onRequested={() => {
            profile.reload();
            setRequestsVersion((current) => current + 1);
          }}
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

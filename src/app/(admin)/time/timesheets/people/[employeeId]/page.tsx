import { ConsultantTimesheetPage } from "@/components/time/ConsultantTimesheetPage";

export const metadata = { title: "Consultant timesheet" };

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <ConsultantTimesheetPage employeeId={employeeId} />;
}

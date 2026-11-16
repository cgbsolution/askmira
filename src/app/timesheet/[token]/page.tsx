import { TimesheetApprovalScreen } from "@/components/consultants/TimesheetApprovalScreen";

export const metadata = {
  title: "Approve timesheet",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string | string[] }>;
}) {
  const { token } = await params;
  const { answer } = await searchParams;
  const preselected = answer === "approve" || answer === "reject" ? answer : null;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-10">
      <TimesheetApprovalScreen token={token} preselected={preselected} />
    </main>
  );
}

import { PageShell } from "@/components/common/PageShell";
import { AttendanceReview } from "@/components/attendance/AttendanceReview";

export const metadata = { title: "Attendance review" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <PageShell
      title="Attendance review"
      description="Who is in today, requests to decide, and exceptions to resolve."
    >
      <AttendanceReview initialTab={tab} />
    </PageShell>
  );
}

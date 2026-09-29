import { PageShell } from "@/components/common/PageShell";
import { AttendanceReview } from "@/components/attendance/AttendanceReview";

export const metadata = { title: "Attendance review" };

export default function Page() {
  return (
    <PageShell
      title="Attendance review"
      description="Regularisations to decide and exceptions to resolve."
    >
      <AttendanceReview />
    </PageShell>
  );
}

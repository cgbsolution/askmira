import { AttendanceReports } from "@/components/attendance/AttendanceReports";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Attendance reports" };

export default function Page() {
  return (
    <PageShell
      title="Attendance reports"
      description="Download attendance for a day, a month or a year, including the classic In Out Activities, Monthly Summary and YTD layouts."
    >
      <AttendanceReports />
    </PageShell>
  );
}

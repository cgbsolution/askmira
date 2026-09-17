import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { MyAttendance } from "@/components/attendance/MyAttendance";

export const metadata = { title: "Attendance" };

export default function Page() {
  return (
    <PageShell title="Attendance" description="Punches, your attendance days and regularisations.">
      <SectionNav section="time" />
      <MyAttendance />
    </PageShell>
  );
}

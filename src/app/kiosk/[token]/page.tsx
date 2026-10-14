import { KioskScreen } from "@/components/attendance/KioskScreen";

export const metadata = { title: "Punch kiosk" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center bg-background px-4 py-10">
      <KioskScreen token={token} />
    </main>
  );
}

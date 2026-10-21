import { EmailActionScreen } from "@/components/approvals/EmailActionScreen";

export const metadata = { title: "Approve or reject", robots: { index: false, follow: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ do?: string }>;
}) {
  const { token } = await params;
  const { do: chosen } = await searchParams;
  return (
    <main className="flex min-h-screen items-center bg-background px-4 py-10">
      <EmailActionScreen token={token} chosen={chosen === "reject" ? "reject" : "approve"} />
    </main>
  );
}

import { LifecycleApproval } from "@/components/approvals/LifecycleApproval";

export const metadata = { title: "Lifecycle approval" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LifecycleApproval eventId={id} />;
}

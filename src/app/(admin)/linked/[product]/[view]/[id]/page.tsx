import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { HelpdeskTicketView } from "@/components/products/helpdesk/HelpdeskTicketView";

export const metadata = { title: "Ticket" };

/** One record of a linked product. Only CGB Helpdesk tickets have a page of their own. */
export default async function Page({
  params,
}: {
  params: Promise<{ product: string; view: string; id: string }>;
}) {
  const { product, view, id } = await params;
  if (product === "helpdesk" && view === "tickets") return <HelpdeskTicketView ticketId={id} />;
  return (
    <PageShell title="Not found">
      <ErrorState message="There is no such page." />
    </PageShell>
  );
}

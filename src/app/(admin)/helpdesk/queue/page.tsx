import { QueueScreen } from "@/components/helpdesk/QueueScreen";

export const metadata = { title: "Ticket queue" };

export default function Page() {
  return (
    <QueueScreen
      title="Ticket queue"
      description="Every helpdesk ticket you can work, with its deadline. Tickets you raised yourself are on My tickets, not here."
    />
  );
}

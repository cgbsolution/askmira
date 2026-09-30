import { QueueScreen } from "@/components/helpdesk/QueueScreen";

export const metadata = { title: "My ticket queue" };

/**
 * The same queue, for a category owner outside HR — an IT admin who owns
 * "IT & access", say. Reached from My tickets; the server decides which
 * tickets come back.
 */
export default function Page() {
  return (
    <QueueScreen
      title="My ticket queue"
      description="Tickets in the helpdesk categories you own, and any assigned to you."
    />
  );
}

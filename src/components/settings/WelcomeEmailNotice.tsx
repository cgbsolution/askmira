import { MailCheck, MailWarning } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { WelcomeEmail } from "@/lib/types/admin";
import { formatDate } from "@/lib/utils";

/**
 * What became of a new login's welcome email, said plainly.
 *
 * Only "sent" is green. A workspace with no mail relay "sends" to the server
 * log, and an admin who reads that as delivered leaves a new joiner waiting
 * for an email that never comes.
 */
export function WelcomeEmailNotice({ welcome }: { welcome: WelcomeEmail }) {
  if (welcome.status === "sent") {
    return (
      <Alert variant="success">
        <MailCheck />
        <AlertTitle>Welcome email sent to {welcome.sent_to}</AlertTitle>
        <AlertDescription>
          {welcome.link_expires_at
            ? `It has their sign-in page and a link to set their own password, which works once and until ${formatDate(welcome.link_expires_at)}.`
            : "It has their sign-in page; they sign in with the company account."}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant={welcome.status === "queued" ? "default" : "warning"}>
      <MailWarning />
      <AlertTitle>
        {welcome.status === "queued"
          ? `Welcome email to ${welcome.sent_to} is queued`
          : `The welcome email did not reach ${welcome.sent_to}`}
      </AlertTitle>
      <AlertDescription>{welcome.detail}</AlertDescription>
    </Alert>
  );
}

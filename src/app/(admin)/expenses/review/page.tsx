import { PageShell } from "@/components/common/PageShell";
import { ReviewWorkspace } from "@/components/expenses/ReviewWorkspace";

export const metadata = { title: "Finance review" };

export default function Page() {
  return (
    <PageShell title="Finance review" description="Claims, trips and advances waiting on finance.">
      <ReviewWorkspace />
    </PageShell>
  );
}

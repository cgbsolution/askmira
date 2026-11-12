import { LetterLinkScreen } from "@/components/docs/LetterLinkScreen";

export const metadata = {
  title: "Read and sign your letter",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-10">
      <LetterLinkScreen token={token} />
    </main>
  );
}

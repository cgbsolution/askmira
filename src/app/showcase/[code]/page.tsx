import { ShowcaseScreen } from "@/components/showcase/ShowcaseScreen";

export const metadata = {
  title: "Ask Miraa: one order, signature to day one",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ShowcaseScreen code={code} />;
}

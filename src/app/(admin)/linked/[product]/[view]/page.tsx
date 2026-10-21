import { LinkedProductView } from "@/components/products/LinkedProductView";

export const metadata = { title: "Linked product" };

export default async function Page({
  params,
}: {
  params: Promise<{ product: string; view: string }>;
}) {
  const { product, view } = await params;
  return <LinkedProductView product={product} view={view} />;
}

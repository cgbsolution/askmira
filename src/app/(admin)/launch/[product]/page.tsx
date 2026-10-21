import { LaunchProduct } from "@/components/products/LaunchProduct";

export const metadata = { title: "Opening" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const { product } = await params;
  const { to } = await searchParams;
  return <LaunchProduct product={product} to={typeof to === "string" ? to : undefined} />;
}

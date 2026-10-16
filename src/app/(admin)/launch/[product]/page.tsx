import { LaunchProduct } from "@/components/products/LaunchProduct";

export const metadata = { title: "Opening" };

export default async function Page({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  return <LaunchProduct product={product} />;
}

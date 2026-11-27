import Customer from "@/components/customer";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ restaurant_slug: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const p = await params,
    s = await searchParams;
  return <Customer slug={p.restaurant_slug} tableNo={Number(s.table) || 0} />;
}

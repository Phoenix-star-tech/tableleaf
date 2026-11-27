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
  const tableNo = Number(s.table) || 0;
  return <Customer key={p.restaurant_slug + ":" + tableNo} slug={p.restaurant_slug} tableNo={tableNo} />;
}

import { Orders } from '../../../components/Orders';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Orders id={id} />;
}

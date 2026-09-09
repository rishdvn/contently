import { ChatView } from "../chat-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatView key={id} threadId={id} />;
}

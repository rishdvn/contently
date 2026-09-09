import { Editor } from "@/components/editor/Editor";

export const metadata = {
  title: "Studio · Contently",
};

export default async function EditorPage(props: PageProps<"/editor/[id]">) {
  const { id } = await props.params;
  const { kind } = await props.searchParams;
  return <Editor projectId={id} kind={typeof kind === "string" ? kind : undefined} />;
}

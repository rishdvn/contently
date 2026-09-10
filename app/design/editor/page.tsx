import { surfaceMetadata } from "../_surface-page";
import { EditorDemo } from "./editor-demo";

export const metadata = surfaceMetadata("Editor");

export default function EditorPage() {
  return <EditorDemo />;
}

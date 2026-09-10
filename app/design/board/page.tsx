import { surfaceMetadata } from "../_surface-page";
import { BoardDemo } from "./board-demo";

export const metadata = surfaceMetadata("Board");

export default function BoardPage() {
  return <BoardDemo />;
}

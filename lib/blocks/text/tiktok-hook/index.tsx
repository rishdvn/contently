import { registerBlock } from "../../registry";

import { Hook } from "./Hook";
import { tiktokHook } from "./schema";

registerBlock({ ...tiktokHook, render: (props, ctx) => <Hook props={props} ctx={ctx} /> });

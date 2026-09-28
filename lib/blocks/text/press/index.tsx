import { registerBlock } from "../../registry";

import { Press } from "./Press";
import { press } from "./schema";

registerBlock({ ...press, render: (props, ctx) => <Press props={props} ctx={ctx} /> });

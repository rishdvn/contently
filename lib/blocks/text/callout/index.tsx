import { registerBlock } from "../../registry";

import { Callout } from "./Callout";
import { callout } from "./schema";

registerBlock({ ...callout, render: (props, ctx) => <Callout props={props} ctx={ctx} /> });

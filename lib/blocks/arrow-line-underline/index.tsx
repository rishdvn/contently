import { registerBlock } from "../registry";

import { arrowLineUnderline } from "./schema";
import { Stroke } from "./Stroke";

registerBlock({ ...arrowLineUnderline, render: (props, ctx) => <Stroke props={props} ctx={ctx} /> });

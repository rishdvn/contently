import { registerBlock } from "../registry";

import { splitLayout } from "./schema";
import { Split } from "./Split";

registerBlock({ ...splitLayout, render: (props, ctx) => <Split props={props} ctx={ctx} /> });

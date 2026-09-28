import { registerBlock } from "../registry";

import { Browser } from "./Browser";
import { browserFrame } from "./schema";

registerBlock({ ...browserFrame, render: (props, ctx) => <Browser props={props} ctx={ctx} /> });

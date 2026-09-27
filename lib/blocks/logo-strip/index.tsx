import { registerBlock } from "../registry";

import { logoStrip } from "./schema";
import { Strip } from "./Strip";

registerBlock({ ...logoStrip, render: (props, ctx) => <Strip props={props} ctx={ctx} /> });

import { registerBlock } from "../registry";

import { Phone } from "./Phone";
import { phoneFrame } from "./schema";

registerBlock({ ...phoneFrame, render: (props, ctx) => <Phone props={props} ctx={ctx} /> });

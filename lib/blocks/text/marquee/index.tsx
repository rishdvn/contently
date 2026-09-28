import { registerBlock } from "../../registry";

import { Marquee } from "./Marquee";
import { marquee } from "./schema";

registerBlock({ ...marquee, render: (props, ctx) => <Marquee props={props} ctx={ctx} /> });

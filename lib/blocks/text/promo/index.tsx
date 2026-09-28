import { registerBlock } from "../../registry";

import { Promo } from "./Promo";
import { promo } from "./schema";

registerBlock({ ...promo, render: (props, ctx) => <Promo props={props} ctx={ctx} /> });

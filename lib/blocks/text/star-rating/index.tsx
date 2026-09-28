import { registerBlock } from "../../registry";

import { starRating } from "./schema";
import { Stars } from "./Stars";

registerBlock({ ...starRating, render: (props, ctx) => <Stars props={props} ctx={ctx} /> });

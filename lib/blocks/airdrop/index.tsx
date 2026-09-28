import { registerBlock } from "../registry";

import { Sheet } from "./Sheet";
import { airdrop } from "./schema";

registerBlock({ ...airdrop, render: (props, ctx) => <Sheet props={props} ctx={ctx} /> });

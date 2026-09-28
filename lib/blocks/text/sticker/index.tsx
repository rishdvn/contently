import { registerBlock } from "../../registry";

import { sticker } from "./schema";
import { Sticker } from "./Sticker";

registerBlock({ ...sticker, render: (props, ctx) => <Sticker props={props} ctx={ctx} /> });

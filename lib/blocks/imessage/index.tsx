import { registerBlock } from "../registry";

import { imessage } from "./schema";
import { Thread } from "./Thread";

registerBlock({ ...imessage, render: (props, ctx) => <Thread props={props} ctx={ctx} /> });

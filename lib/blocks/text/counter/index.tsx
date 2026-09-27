import { registerBlock } from "../../registry";

import { Counter } from "./Counter";
import { counter } from "./schema";

registerBlock({ ...counter, render: (props, ctx) => <Counter props={props} ctx={ctx} /> });

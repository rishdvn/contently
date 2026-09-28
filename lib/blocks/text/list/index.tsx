import { registerBlock } from "../../registry";

import { List } from "./List";
import { list } from "./schema";

registerBlock({ ...list, render: (props, ctx) => <List props={props} ctx={ctx} /> });

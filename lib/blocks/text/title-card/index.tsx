import { registerBlock } from "../../registry";

import { titleCard } from "./schema";
import { Title } from "./Title";

registerBlock({ ...titleCard, render: (props, ctx) => <Title props={props} ctx={ctx} /> });

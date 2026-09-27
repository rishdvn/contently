import { registerBlock } from "../registry";

import { Card } from "./Card";
import { productCard } from "./schema";

registerBlock({ ...productCard, render: (props, ctx) => <Card props={props} ctx={ctx} /> });

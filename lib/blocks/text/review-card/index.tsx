import { registerBlock } from "../../registry";

import { Card } from "./Card";
import { reviewCard } from "./schema";

registerBlock({ ...reviewCard, render: (props, ctx) => <Card props={props} ctx={ctx} /> });

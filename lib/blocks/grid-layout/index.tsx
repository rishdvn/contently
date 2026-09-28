import { registerBlock } from "../registry";

import { Grid } from "./Grid";
import { gridLayout } from "./schema";

registerBlock({ ...gridLayout, render: (props, ctx) => <Grid props={props} ctx={ctx} /> });

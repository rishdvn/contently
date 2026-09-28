import { registerBlock } from "../../registry";

import { Button } from "./Button";
import { button } from "./schema";

registerBlock({ ...button, render: (props, ctx) => <Button props={props} ctx={ctx} /> });

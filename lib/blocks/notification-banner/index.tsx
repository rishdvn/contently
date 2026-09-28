import { registerBlock } from "../registry";

import { Banner } from "./Banner";
import { notificationBanner } from "./schema";

registerBlock({ ...notificationBanner, render: (props, ctx) => <Banner props={props} ctx={ctx} /> });

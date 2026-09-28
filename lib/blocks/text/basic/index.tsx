import { registerBlock } from "../../registry";

import { Basic } from "./Basic";
import { basic } from "./schema";

registerBlock({ ...basic, render: (props, ctx) => <Basic props={props} ctx={ctx} /> });

import { registerBlock } from "../registry";

import { Carousel } from "./Carousel";
import { imageCarousel } from "./schema";

registerBlock({ ...imageCarousel, render: (props, ctx) => <Carousel props={props} ctx={ctx} /> });

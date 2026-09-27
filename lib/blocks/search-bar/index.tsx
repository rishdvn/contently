import { registerBlock } from "../registry";

import { searchBar } from "./schema";
import { Search } from "./Search";

registerBlock({ ...searchBar, render: (props, ctx) => <Search props={props} ctx={ctx} /> });

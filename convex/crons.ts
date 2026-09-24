import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

/*
  Scheduled work. Registered here rather than next to the job it runs so there is
  one place to read what this deployment does on its own, and one place that has
  to change when a schedule does. Convex shows the same list under Schedules.
*/

const crons = cronJobs();

/*
  Soundstripe signs its CDN URLs with a token that expires within seven days, so
  the catalog has to be re-indexed on a cycle shorter than that whether or not
  anything upstream changed; nightly is what Soundstripe recommends. 03:15 UTC is
  the quiet end of every timezone we care about, and the offset keeps it off the
  hour, where every other integration's cron lands.
*/
crons.daily("soundstripe index", { hourUTC: 3, minuteUTC: 15 }, internal.audio.index.run, {});

export default crons;

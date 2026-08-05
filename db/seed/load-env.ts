import { config } from "dotenv";

/** Side-effect import first in seed entrypoints so `@/lib/db` sees env. */
config({ path: ".env.local" });

import "./load-env";

import { backfillAllPublicIds } from "@/lib/leagues/ensure-public-ids";

async function main() {
  await backfillAllPublicIds();
  console.log("Backfilled league and team public ids.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

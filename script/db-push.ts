import { execSync } from "child_process";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDbPush() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[db-push] Attempt ${attempt}/${MAX_RETRIES}...`);
      execSync("npx drizzle-kit push --force", {
        stdio: "inherit",
        timeout: 60000,
        env: { ...process.env },
      });
      console.log("[db-push] Schema migration completed successfully.");
      return;
    } catch (err: any) {
      console.error(`[db-push] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.log(`[db-push] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  console.error(`[db-push] All ${MAX_RETRIES} attempts failed. Exiting.`);
  process.exit(1);
}

runDbPush();

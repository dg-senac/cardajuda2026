import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { stdio: "inherit", cwd });
if (!existsSync("android")) run("npx", ["cap", "add", "android"]);
run("npx", ["cap", "sync", "android"]);
run("node", ["scripts/android-patch.mjs"]);
run("./gradlew", ["assembleDebug"], "android");

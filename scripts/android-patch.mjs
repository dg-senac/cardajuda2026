import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function aplicarPatch(xml) {
  let result = xml;
  for (const attr of ["usesCleartextTraffic", "allowBackup"]) {
    const regex = new RegExp(`android:${attr}="[^"]*"`);
    result = regex.test(result)
      ? result.replace(regex, `android:${attr}="false"`)
      : result.replace(
          /<application\b/,
          `<application android:${attr}="false"`,
        );
  }
  return { xml: result, mudou: xml !== result };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const file = "android/app/src/main/AndroidManifest.xml";
  if (!fs.existsSync(file))
    throw new Error("Execute cap add android primeiro.");
  fs.writeFileSync(file, aplicarPatch(fs.readFileSync(file, "utf8")).xml);
}

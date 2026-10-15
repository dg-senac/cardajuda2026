import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { build } from "esbuild";
import { validateSupabaseUrl } from "./android-config.mjs";
import { aplicarPatch } from "./android-patch.mjs";
const read = (p) => fs.readFileSync(p, "utf8");
test("APK local, sem navegação remota, mixed content ou seleção de servidor", () => {
  const config = JSON.parse(read("capacitor.config.json"));
  assert.equal(config.webDir, "www");
  assert.equal(config.server.url, undefined);
  assert.equal(config.server.cleartext, false);
  assert.equal(config.server.allowNavigation, undefined);
  assert.equal(config.android.allowMixedContent, false);
  assert.doesNotMatch(
    read("www/index.html") + read("mobile/app.tsx"),
    /TrocarServidor|APP_SERVER_URL|window\.location|localStorage/,
  );
  assert.match(read("www/index.html"), /Content-Security-Policy/);
});
test("build exige URL real de projeto e não aceita segredos ou servidores próprios", () => {
  assert.equal(
    validateSupabaseUrl("https://abcdefgh.supabase.co"),
    "https://abcdefgh.supabase.co",
  );
  for (const s of [
    "",
    "http://abc.supabase.co",
    "https://example.com",
    "https://a:b@abc.supabase.co",
    "https://abc.supabase.co/functions",
    "https://abc.supabase.co?token=x",
  ])
    assert.throws(() => validateSupabaseUrl(s));
  assert.doesNotMatch(
    read(".github/workflows/build-android-apk.yml").replaceAll("TEST_DATABASE_URL", "LOCAL_TEST_DB"),
    /APP_SERVER_URL|DATABASE_URL|SERVICE_ROLE/,
  );
});
test("bundle browser não contém módulos/credenciais de servidor", async () => {
  const result = await build({
    entryPoints: ["mobile/app.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    metafile: true,
    define: { __SUPABASE_URL__: '"https://test.supabase.co"' },
  });
  assert.doesNotMatch(
    Object.keys(result.metafile.inputs).join("\n"),
    /src\/db|src\/lib\/actions|bcrypt|node_modules\/pg\//,
  );
  assert.doesNotMatch(
    result.outputFiles[0].text,
    /DATABASE_URL|SERVICE_ROLE_KEY|password_hash/,
  );
});
test("manifesto desliga backup e HTTP, idempotente", () => {
  const a = aplicarPatch(
    '<manifest><application android:allowBackup="true" android:usesCleartextTraffic="true"></application></manifest>',
  );
  assert.match(a.xml, /allowBackup="false"/);
  assert.match(a.xml, /usesCleartextTraffic="false"/);
  assert.equal(aplicarPatch(a.xml).mudou, false);
});
test("matriz de propriedade/papel do prontuário", async () => {
  const bundle = await build({
    entryPoints: ["edge/policy.ts"],
    bundle: true,
    write: false,
    format: "esm",
  });
  const { canReadPatient: can } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  assert.equal(can("paciente", "a", "a", false, false), true);
  assert.equal(can("paciente", "a", "b", true, true), false);
  assert.equal(can("medico", "a", "b", false, true), false);
  assert.equal(can("medico", "a", "b", true, false), false);
  assert.equal(can("medico", "a", "b", true, true), true);
  assert.equal(can("admin", "a", "b", true, true), false);
});

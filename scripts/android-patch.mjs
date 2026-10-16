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
  let xml = aplicarPatch(fs.readFileSync(file, "utf8")).xml;
  xml = xml.replace(/android:icon="[^"]*"/, 'android:icon="@drawable/brand_icon"').replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@drawable/brand_icon"');
  xml = xml.replace(/<application\b/, '<application android:fullBackupContent="false" android:dataExtractionRules="@xml/data_extraction_rules"');
  xml = xml.replace(/(android:fullBackupContent="false"|android:dataExtractionRules="@xml\/data_extraction_rules")(?=[\s\S]*\1)/g, '');
  fs.writeFileSync(file, xml);
  fs.mkdirSync("android/app/src/main/res/xml", { recursive: true });
  fs.writeFileSync("android/app/src/main/res/xml/data_extraction_rules.xml", `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup><exclude domain="root" path="."/><exclude domain="file" path="."/><exclude domain="database" path="."/><exclude domain="sharedpref" path="."/><exclude domain="external" path="."/></cloud-backup><device-transfer><exclude domain="root" path="."/><exclude domain="file" path="."/><exclude domain="database" path="."/><exclude domain="sharedpref" path="."/><exclude domain="external" path="."/></device-transfer></data-extraction-rules>`);
  const res = "android/app/src/main/res";
  fs.mkdirSync(`${res}/drawable`, { recursive: true });
  fs.writeFileSync(`${res}/drawable/brand_icon.xml`, `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
<path android:fillColor="#F3D4EE" android:pathData="M0,0h108v108h-108z"/>
<path android:fillColor="#8B008B" android:pathData="M54,84C46,77 22,61 22,43C22,25 43,20 54,35C65,20 86,25 86,43C86,61 62,77 54,84z"/>
<path android:strokeColor="#FFFFFF" android:strokeWidth="3" android:strokeLineJoin="round" android:strokeLineCap="round" android:fillColor="@android:color/transparent" android:pathData="M29,52L40,52L46,40L53,65L60,46L65,55L79,55"/>
</vector>`);
  fs.writeFileSync(`${res}/values/colors.xml`, `<?xml version="1.0" encoding="utf-8"?><resources><color name="colorPrimary">#8B008B</color><color name="colorPrimaryDark">#4B0049</color><color name="colorAccent">#B13FB1</color><color name="brandBackground">#FDF7FB</color></resources>`);
  fs.writeFileSync(`${res}/values/styles.xml`, `<?xml version="1.0" encoding="utf-8"?><resources>
<style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar"><item name="colorPrimary">@color/colorPrimary</item><item name="colorAccent">@color/colorAccent</item><item name="android:windowLightStatusBar">true</item><item name="android:statusBarColor">@color/brandBackground</item><item name="android:navigationBarColor">@color/brandBackground</item><item name="android:windowLightNavigationBar">true</item><item name="android:windowSoftInputMode">adjustResize</item></style>
<style name="AppTheme.NoActionBar" parent="AppTheme"><item name="windowActionBar">false</item><item name="windowNoTitle">true</item></style>
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen"><item name="windowSplashScreenBackground">@color/brandBackground</item><item name="windowSplashScreenAnimatedIcon">@drawable/brand_icon</item><item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item></style>
</resources>`);
}

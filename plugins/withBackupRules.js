const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

/**
 * Says what Android's own backup keeps of Tread.
 *
 * Android backs an app up to the owner's Google account by itself — no Tread
 * account, which is the point — but it stops at 25 MB, and past that it keeps
 * nothing at all. Photos added to runs would reach that alone. So the cloud
 * copy holds what cannot be found again anywhere else and is small: the
 * database (runs, routes, plans, settings) and the routes' pictures. A
 * transfer straight to a new phone, by cable or over wifi, has no such limit
 * and takes the photos too.
 *
 * iOS needs nothing of the kind: everything Tread keeps is in its Documents
 * folder, which iCloud and computer backups include whole.
 */
const KEPT = ["SQLite/", "routes/"];
const TRANSFERRED = [...KEPT, "photos/"];

const include = (paths, indent) =>
  paths.map((dir) => `${indent}<include domain="file" path="${dir}" />`).join("\n");

// Android 11 and below.
const FULL_BACKUP = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${include(KEPT, "  ")}
</full-backup-content>
`;

// Android 12 and above: the cloud and a direct transfer are told apart.
const DATA_EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${include(KEPT, "    ")}
  </cloud-backup>
  <device-transfer>
${include(TRANSFERRED, "    ")}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withBackupRules(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const xml = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(xml, { recursive: true });
      fs.writeFileSync(path.join(xml, "tread_backup_rules.xml"), FULL_BACKUP);
      fs.writeFileSync(path.join(xml, "tread_data_extraction_rules.xml"), DATA_EXTRACTION);
      return mod;
    },
  ]);

  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error("withBackupRules found no <application> in the manifest.");
    application.$["android:allowBackup"] = "true";
    application.$["android:fullBackupContent"] = "@xml/tread_backup_rules";
    application.$["android:dataExtractionRules"] = "@xml/tread_data_extraction_rules";
    return mod;
  });
};

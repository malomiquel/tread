const { withInfoPlist } = require("expo/config-plugins");

/**
 * Names the app's folder in iCloud Drive after the app — "Tread" — rather
 * than after its lower-case slug, which is what react-native-cloud-storage
 * writes. The folder is what a runner sees in Files, and where their safety
 * copies are; it should look like the app they know.
 *
 * Listed before that plugin in app.json: mods of one kind run last-listed
 * first, so being earlier in the list is what gives this one the last word.
 */
module.exports = function withICloudFolderName(config) {
  return withInfoPlist(config, (plist) => {
    for (const container of Object.values(plist.modResults.NSUbiquitousContainers ?? {})) {
      container.NSUbiquitousContainerName = config.name;
    }
    return plist;
  });
};

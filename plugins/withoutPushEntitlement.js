const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Drops the push entitlement that expo-notifications adds by default.
 *
 * That library configures itself for both kinds of notification, so its
 * config plugin writes `aps-environment` into the entitlements — the key that
 * declares an app able to receive pushes from a server. Tread has no server
 * and sends none: its reminders are scheduled on the device, by the device,
 * and local notifications need no entitlement at all.
 *
 * Left in place, the key makes every iOS build demand a provisioning profile
 * carrying the Push Notifications capability, which is a paid-account feature
 * and which no free team profile has. That is the build failing with
 * "Provisioning Profile … does not support the Push Notifications capability"
 * over a capability the app never uses.
 *
 * Applied last, after the plugin that added it. If remote push is ever wanted
 * here, this file is what to delete.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (entitlements) => {
    delete entitlements.modResults["aps-environment"];
    return entitlements;
  });
};

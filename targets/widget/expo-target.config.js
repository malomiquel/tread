/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "TreadWidgets",
  // Live Activities and the Dynamic Island both arrived in 16.1, and
  // ActivityKit's push-free update path settled in 16.2.
  deploymentTarget: "16.2",
};

const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

/**
 * Moves the iOS app onto the scene-based life cycle.
 *
 * Apps built with the iOS 27 SDK refuse to launch without it ("UIScene life
 * cycle is required for apps built with this SDK"), and the SDK 57 template
 * still starts React Native from the app delegate. The expo package already
 * ships the scene delegate this needs, `ExpoAppSceneDelegate`: it creates the
 * window from the connecting scene, starts React Native into it and forwards
 * links, activities and life-cycle events back to the app delegate.
 *
 * So two changes, both to generated files and both undone by deleting this
 * plugin once the template adopts scenes itself:
 *
 * - Info.plist declares one application scene, handled by that delegate.
 * - The app delegate stops making its own window and starting React Native,
 *   which would otherwise happen twice, and says where the scene delegate
 *   finds the factory it created (`ExpoReactNativeFactoryProvider`).
 */
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (plist) => {
    plist.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return plist;
  });

  return withAppDelegate(config, (appDelegate) => {
    if (appDelegate.modResults.language !== "swift") {
      throw new Error("withSceneLifecycle only knows the Swift app delegate.");
    }
    let contents = appDelegate.modResults.contents;

    if (!contents.includes("ExpoReactNativeFactoryProvider")) {
      contents = contents.replace(
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      );
    }

    // The window and the start of React Native now belong to the scene.
    contents = contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      "\n",
    );

    if (!contents.includes("ExpoReactNativeFactoryProvider") || contents.includes("UIScreen.main.bounds")) {
      throw new Error("withSceneLifecycle could not adapt the app delegate: the template has changed.");
    }
    appDelegate.modResults.contents = contents;
    return appDelegate;
  });
};

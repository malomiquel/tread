import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { weekWidget } from "@/components/WeekWidget";
import { initDb } from "./db";
import { currentWidgetSnapshot } from "./homeWidget";
import { loadSettings } from "./settings";

/**
 * What Android runs when the launcher asks for the widget: when it is
 * placed, resized, or due for its periodic refresh.
 *
 * This may run with the app closed, in a JavaScript context of its own, so it
 * opens the database and reads the settings itself before writing anything.
 * Taps need no handling here: the whole widget opens the app natively.
 */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction !== "WIDGET_ADDED" && widgetAction !== "WIDGET_UPDATE" && widgetAction !== "WIDGET_RESIZED") {
    return;
  }
  let snapshot = null;
  try {
    await initDb();
    await loadSettings();
    snapshot = await currentWidgetSnapshot();
  } catch {
    /* the app's name, and a tap opens it */
  }
  renderWidget(weekWidget(snapshot, widgetInfo.width));
}

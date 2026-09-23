"use no memo";
// The widget library walks the tree by calling each component as a plain
// function; memoised output from the compiler would break that walk.

import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetSnapshot } from "@/lib/widgetSnapshot";

/**
 * The Android home-screen widget: the week so far, and the next planned
 * session. The same two panels as HomeWidget.swift, drawn from the same
 * snapshot, so both phones say the same thing in the same words.
 *
 * Widgets on Android are drawn from a description, not rendered by React
 * Native, so none of the app's dynamic colours reach them: each appearance
 * gets its own literal palette, and the launcher picks one.
 */

/** Must match the widget's name in app.json. */
export const WEEK_WIDGET = "TreadWeek";

/** From this width in dp the next session gets its own panel beside the week. */
const WIDE_DP = 250;

type HexColor = `#${string}`;

interface Palette {
  background: HexColor;
  text: HexColor;
  subtle: HexColor;
  accent: HexColor;
  track: HexColor;
}

// The theme's colours, written out: text at 42–62% becomes a solid grey.
const PALETTES: Record<"light" | "dark", Palette> = {
  light: { background: "#ffffff", text: "#101010", subtle: "#6b6b6b", accent: "#00348f", track: "#f4f4f4" },
  dark: { background: "#0b0b0c", text: "#f2f2f3", subtle: "#8f8f92", accent: "#6fa8ff", track: "#18181a" },
};

/** Faces copied into the Android assets by the plugin (see app.json). */
const SEMIBOLD = "BarlowCondensed_600SemiBold";
const BOLD = "BarlowCondensed_700Bold";

interface Props {
  snapshot: WidgetSnapshot | null;
  palette: Palette;
  wide: boolean;
}

function Label({ text, palette }: { text: string; palette: Palette }) {
  return (
    <TextWidget
      text={text.toUpperCase()}
      style={{ fontFamily: SEMIBOLD, fontSize: 12, letterSpacing: 0.08, color: palette.subtle }}
    />
  );
}

function Week({ snapshot, palette }: { snapshot: WidgetSnapshot; palette: Palette }) {
  const share = snapshot.goalShare;
  return (
    <FlexWidget style={{ flex: 1, height: "match_parent", flexDirection: "column" }}>
      <Label text={snapshot.thisWeek} palette={palette} />
      <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end", flexGap: 3 }}>
        <TextWidget text={snapshot.distance} style={{ fontFamily: SEMIBOLD, fontSize: 38, color: palette.accent }} />
        <TextWidget
          text={snapshot.unit}
          style={{ fontFamily: SEMIBOLD, fontSize: 16, color: palette.subtle, marginBottom: 6 }}
        />
      </FlexWidget>
      <FlexWidget style={{ flex: 1 }} />
      {share === null ? (
        <TextWidget
          text={snapshot.detail}
          maxLines={1}
          truncate="END"
          style={{ fontFamily: SEMIBOLD, fontSize: 14, color: palette.subtle }}
        />
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
          <FlexWidget
            style={{
              width: "match_parent", height: 4, borderRadius: 2,
              flexDirection: "row", backgroundColor: palette.track, overflow: "hidden",
            }}
          >
            {share > 0 ? (
              <FlexWidget style={{ flex: share, height: 4, borderRadius: 2, backgroundColor: palette.accent }} />
            ) : null}
            {share < 1 ? <FlexWidget style={{ flex: 1 - share, height: 4 }} /> : null}
          </FlexWidget>
          <TextWidget
            text={snapshot.goalText ?? ""}
            maxLines={2}
            truncate="END"
            style={{ fontFamily: SEMIBOLD, fontSize: 13, color: palette.subtle }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function Next({ snapshot, palette }: { snapshot: WidgetSnapshot; palette: Palette }) {
  const next = snapshot.next;
  return (
    <FlexWidget style={{ flex: 1, height: "match_parent", flexDirection: "column", flexGap: 2 }}>
      <Label text={snapshot.nextTitle} palette={palette} />
      {next === null ? (
        <TextWidget
          text={snapshot.noPlan}
          maxLines={2}
          truncate="END"
          style={{ fontFamily: SEMIBOLD, fontSize: 15, color: palette.subtle }}
        />
      ) : (
        <FlexWidget style={{ flexDirection: "column", flexGap: 2 }}>
          <TextWidget text={next.when} style={{ fontFamily: SEMIBOLD, fontSize: 15, color: palette.accent }} />
          <TextWidget
            text={next.name}
            maxLines={2}
            truncate="END"
            style={{ fontFamily: SEMIBOLD, fontSize: 19, color: palette.text }}
          />
          <TextWidget
            text={next.detail}
            maxLines={1}
            truncate="END"
            style={{ fontFamily: SEMIBOLD, fontSize: 13, color: palette.subtle }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function WeekWidget({ snapshot, palette, wide }: Props) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent", height: "match_parent", padding: 16, borderRadius: 16,
        backgroundColor: palette.background,
        flexDirection: "row", flexGap: 16,
        ...(snapshot === null ? { alignItems: "center", justifyContent: "center" } : {}),
      }}
    >
      {snapshot === null ? (
        <TextWidget text="Tread" style={{ fontFamily: BOLD, fontSize: 24, color: palette.accent }} />
      ) : (
        // No fragments: the widget renderer only knows its own components.
        [
          <Week key="week" snapshot={snapshot} palette={palette} />,
          wide ? <Next key="next" snapshot={snapshot} palette={palette} /> : null,
        ]
      )}
    </FlexWidget>
  );
}

/**
 * Both appearances of the widget at a given width. A null snapshot — the
 * database could not be read — shows the app's name, and a tap opens it.
 */
export function weekWidget(snapshot: WidgetSnapshot | null, widthDp: number) {
  const wide = widthDp >= WIDE_DP;
  return {
    light: <WeekWidget snapshot={snapshot} palette={PALETTES.light} wide={wide} />,
    dark: <WeekWidget snapshot={snapshot} palette={PALETTES.dark} wide={wide} />,
  };
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { colors, floatingShadow, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

export interface MenuItem {
  key: string;
  label: string;
  icon: Icon;
  /** Red, and kept last: the one that cannot be undone. */
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  items: MenuItem[];
  /** Said by VoiceOver for the button that opens the menu. */
  accessibilityLabel: string;
}

const WIDTH = 248;
const GAP = 6;

/**
 * A round ⋯ button that opens a menu just under it.
 *
 * For what can be done to the thing a page shows, beside that thing rather
 * than in the navigation bar: the phone's own action sheet rises from the
 * bottom of the screen, far from the finger that asked for it, and reads as
 * a warning even when nothing in it is one. This drops from the button,
 * aligned to its right edge, and closes on any tap outside it.
 */
export function DropdownMenu({ items, accessibilityLabel }: Props) {
  const anchor = useRef<View>(null);
  const window = useWindowDimensions();
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  const open = () => {
    anchor.current?.measureInWindow((x, y, width, height) => {
      setAt({ top: y + height + GAP, right: Math.max(12, window.width - (x + width)) });
    });
  };
  const close = () => setAt(null);

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: at !== null }}
          hitSlop={10}
          style={({ pressed }) => [styles.button, (pressed || at !== null) && styles.buttonOn]}
        >
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
        </Pressable>
      </View>

      <Modal visible={at !== null} transparent animationType="none" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={accessibilityLabel}>
          {at ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(100)}
              style={[styles.menu, { top: at.top, right: at.right }]}
            >
              {/* Stops a tap inside the menu from closing it before the row answers. */}
              <Pressable onPress={() => undefined} accessibilityRole="menu">
                {items.map((item, index) => (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      close();
                      item.onPress();
                    }}
                    accessibilityRole="menuitem"
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && styles.rule,
                      item.destructive && index > 0 && styles.destructiveRule,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text style={[styles.label, item.destructive && styles.destructive]}>{item.label}</Text>
                    <Ionicons name={item.icon} size={18} color={item.destructive ? colors.danger : colors.muted} />
                  </Pressable>
                ))}
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // The same ring as the share button beside it.
  button: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  buttonOn: { backgroundColor: colors.sunken },
  menu: {
    position: "absolute", width: WIDTH, borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
    ...floatingShadow,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  // The destructive row stands a little apart from the others.
  destructiveRule: { borderTopWidth: 6, borderTopColor: colors.sunken },
  rowPressed: { backgroundColor: colors.sunken },
  label: { color: colors.text, fontSize: 16.5, fontFamily: font.medium },
  destructive: { color: colors.danger, fontFamily: font.semibold },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { Fragment } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors } from "@/lib/theme";

/** The marker a sentence uses where the run button belongs. */
export const RUN_BUTTON = "▶";

const buttonStrings = defineStrings({
  fr: { spoken: "Courir" },
  en: { spoken: "Run" },
});

interface Props {
  /** The sentence, with `RUN_BUTTON` wherever the button is meant. */
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * A sentence that points at the run button, showing the button itself.
 *
 * A bare "▶" in running text is a glyph the reader has to match against the
 * bar by eye; the blue disc it stands for is what they will actually be
 * looking for. So the marker is drawn as a small copy of the real thing —
 * same colour, same offset triangle — sized to the line it sits in. Read
 * aloud, the marker becomes the button's name.
 */
export function RunButtonText({ children, style }: Props) {
  const s = useStrings(buttonStrings);
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 15;
  // A shade taller than the letters, so it reads as a button and not as a
  // character, without pushing the line apart.
  const size = Math.round(fontSize * 1.25);
  const parts = children.split(RUN_BUTTON);

  return (
    <Text style={style} accessibilityLabel={parts.join(s.spoken)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <View
              style={[
                styles.disc,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  // Inline views sit on the baseline; this lowers the disc so
                  // its centre lines up with the middle of the letters.
                  transform: [{ translateY: size * 0.22 }],
                },
              ]}
            >
              <Ionicons
                name="play"
                size={Math.round(size * 0.5)}
                color={colors.accentText}
                style={{ marginLeft: size * 0.06 }}
              />
            </View>
          ) : null}
        </Fragment>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
});

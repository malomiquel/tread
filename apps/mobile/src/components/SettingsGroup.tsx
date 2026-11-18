import { Children, Fragment, isValidElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props {
  /** What the rows are about, above the block. */
  title?: string;
  /** The one explanation the rows need, under the block rather than under each row. */
  footer?: string;
  children: React.ReactNode;
}

/** How far a rule is indented past a row's icon, so the icons read as one column. */
const ICON_INSET = 42;

/**
 * A block of settings about one subject.
 *
 * The shape every phone's own settings use — rows on a rounded block, a
 * rule between them, a short heading above and any explanation below — so
 * nothing here has to be learnt. The rule under a row with an icon starts
 * after the icon, as it does on the phone.
 */
export function SettingsGroup({ title, footer, children }: Props) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.block}>
        {rows.map((row, index) => {
          const indented = isValidElement<{ icon?: unknown }>(row) && row.props.icon !== undefined;
          return (
            <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
              {index > 0 ? <View style={[styles.rule, indented && { marginLeft: ICON_INSET }]} /> : null}
              {row}
            </Fragment>
          );
        })}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 22, paddingHorizontal: 16 },
  title: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.medium,
    letterSpacing: 1, textTransform: "uppercase", marginHorizontal: 4, marginBottom: 7,
  },
  block: { borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.sunken },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  footer: {
    color: colors.subtle, fontSize: 13, fontFamily: font.regular, lineHeight: 18,
    marginHorizontal: 4, marginTop: 7,
  },
});

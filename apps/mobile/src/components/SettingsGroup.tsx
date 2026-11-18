import { Children, Fragment, isValidElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PANEL_INSET, PANEL_PADDING } from "@/components/Panel";
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
  // Set like every other panel of the app: 12 in from the edge, radius 20, its
  // labels and rows on the page's 20-point gutter.
  group: { marginTop: 22, paddingHorizontal: PANEL_INSET },
  title: {
    color: colors.subtle, fontSize: 12, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase", marginHorizontal: PANEL_PADDING, marginBottom: 8,
  },
  block: { borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.sunken },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  footer: {
    color: colors.subtle, fontSize: 13, fontFamily: font.regular, lineHeight: 18,
    marginHorizontal: PANEL_PADDING, marginTop: 8,
  },
});

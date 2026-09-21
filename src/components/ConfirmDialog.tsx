import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { colors, floatingShadow, font } from "@/lib/theme";

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Paints the confirming action in the danger colour. */
  destructive?: boolean;
}

/**
 * A confirmation written in the app's own language rather than the system
 * alert, which arrives with its own typeface, radius and button order and
 * reads as borrowed from somewhere else.
 *
 * Cancel sits on the left and carries the quiet treatment, so the destructive
 * action is never the one a thumb finds by accident.
 */
export function ConfirmDialog({
  visible, title, message, confirmLabel, cancelLabel = "Annuler",
  onConfirm, onCancel, destructive = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel={cancelLabel}>
        {/* Stops a tap inside the card from dismissing it. */}
        <Pressable style={styles.dialog} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  dialog: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 20,
    gap: 10,
    ...floatingShadow,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: font.bold, letterSpacing: -0.2 },
  message: { color: colors.muted, fontFamily: font.regular, fontSize: 18, lineHeight: 26.5 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});

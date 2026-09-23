import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChoiceSheet } from "@/components/ChoiceSheet";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import {
  ACTIVITY_ICONS, ACTIVITY_TYPES, activityName, RUN_TAGS, tagName, toggleTag,
} from "@/lib/activity";
import {
  listShoes, setRunActivity, setRunNote, setRunPhotos, setRunShoe, setRunTags, type Run,
} from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { forgetPhotos, keepPhoto, MAX_PHOTOS, photoUri } from "@/lib/photos";
import { shoeOrder, wearOf, type Shoe } from "@/lib/shoes";
import { colors, font } from "@/lib/theme";
import { distanceUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    title: "Détails",
    type: "Type",
    tags: "Étiquettes",
    shoes: "Chaussures",
    noShoe: "Aucune",
    noShoeDetail: "Cette course ne compte pour aucune paire",
    worn: (distance: string) => `à remplacer · ${distance} ${distanceUnit()}`,
    soon: (distance: string) => `bientôt à remplacer · ${distance} ${distanceUnit()}`,
    covered: (distance: string) => `${distance} ${distanceUnit()}`,
    note: "Note",
    notePlaceholder: "Comment c'était, ce qui a marché, ce que tu retiens…",
    photos: "Photos",
    addPhoto: "Ajouter des photos",
    photoFailed: "Photo impossible à ajouter",
    tryAgain: "Réessaie avec une autre photo.",
    removePhoto: "Retirer la photo",
    removeTitle: "Retirer cette photo ?",
    removeMessage: "Elle est retirée de la course. Celle de ta photothèque reste.",
    cancel: "Annuler",
    close: "Fermer",
    photo: (index: number) => `Photo ${index}`,
  },
  en: {
    title: "Details",
    type: "Type",
    tags: "Tags",
    shoes: "Shoes",
    noShoe: "None",
    noShoeDetail: "This run counts for no pair",
    worn: (distance: string) => `due for replacing · ${distance} ${distanceUnit()}`,
    soon: (distance: string) => `due soon · ${distance} ${distanceUnit()}`,
    covered: (distance: string) => `${distance} ${distanceUnit()}`,
    note: "Note",
    notePlaceholder: "How it went, what worked, what to remember…",
    photos: "Photos",
    addPhoto: "Add photos",
    photoFailed: "Couldn't add the photo",
    tryAgain: "Try again with another photo.",
    removePhoto: "Remove photo",
    removeTitle: "Remove this photo?",
    removeMessage: "It comes off the run. The one in your library stays.",
    cancel: "Cancel",
    close: "Close",
    photo: (index: number) => `Photo ${index}`,
  },
});

interface Props {
  run: Run;
  /** Tells the page what changed, so it redraws without reading the run again. */
  onChange: (patch: Partial<Run>) => void;
}

/**
 * What the runner can say about a run that the phone could not measure: what
 * kind of outing it was, what it was for, which pair it was run in.
 */
export function RunDetails({ run, onChange }: Props) {
  const s = useStrings(strings);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [choosingShoe, setChoosingShoe] = useState(false);
  const [choosingType, setChoosingType] = useState(false);
  const [note, setNote] = useState(run.note ?? "");
  const [viewing, setViewing] = useState<string | null>(null);

  const saveNote = () => {
    if (note.trim() === (run.note ?? "")) return;
    onChange({ note: note.trim() || null });
    void setRunNote(run.id, note).catch(() => undefined);
  };

  const addPhotos = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - run.photos.length,
      quality: 0.8,
    });
    if (picked.canceled) return;
    try {
      const added = picked.assets.slice(0, MAX_PHOTOS - run.photos.length).map((asset) => keepPhoto(run.id, asset.uri));
      const photos = [...run.photos, ...added];
      onChange({ photos });
      await setRunPhotos(run.id, photos);
    } catch {
      Alert.alert(s.photoFailed, s.tryAgain);
    }
  };

  const removePhoto = (name: string) => {
    Alert.alert(s.removeTitle, s.removeMessage, [
      { text: s.cancel, style: "cancel" },
      {
        text: s.removePhoto,
        style: "destructive",
        onPress: () => {
          const photos = run.photos.filter((held) => held !== name);
          onChange({ photos });
          setViewing(null);
          void setRunPhotos(run.id, photos).then(() => forgetPhotos([name])).catch(() => undefined);
        },
      },
    ]);
  };

  useEffect(() => {
    let active = true;
    void listShoes().then((found) => {
      if (active) setShoes(shoeOrder(found));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [run.shoeId]);

  const shoe = shoes.find((held) => held.id === run.shoeId) ?? null;
  const shoeLine = (held: Shoe) => {
    const { wear } = wearOf(held);
    const distance = formatDistance(held.distanceM);
    return wear === "worn" ? s.worn(distance) : wear === "soon" ? s.soon(distance) : s.covered(distance);
  };
  // Retired pairs are not offered, except the one this run was already in.
  const offered = shoes.filter((held) => !held.retired || held.id === run.shoeId);

  return (
    <>
      <SettingsGroup title={s.title}>
        <SettingRow
          icon={ACTIVITY_ICONS[run.activity] as "walk-outline"}
          label={s.type}
          value={activityName(run.activity)}
          onPress={() => setChoosingType(true)}
        />
        {/* Nothing to say about shoes before any pair exists: the row would
            only offer "none". */}
        {shoes.length > 0 ? (
          <SettingRow
            icon="footsteps-outline"
            label={s.shoes}
            value={shoe?.name ?? s.noShoe}
            detail={shoe ? shoeLine(shoe) : undefined}
            onPress={() => setChoosingShoe(true)}
          />
        ) : null}
      </SettingsGroup>

      {/* Chips rather than a sheet: several can be on at once, and each is
          one tap either way. */}
      <View style={styles.tags} accessibilityLabel={s.tags}>
        {RUN_TAGS.map((tag) => {
          const on = run.tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => {
                const tags = toggleTag(run.tags, tag);
                onChange({ tags });
                void setRunTags(run.id, tags).catch(() => undefined);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.tag, on && styles.tagOn, pressed && styles.pressed]}
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{tagName(tag)}</Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsGroup title={s.note}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onEndEditing={saveNote}
          onBlur={saveNote}
          placeholder={s.notePlaceholder}
          placeholderTextColor={colors.subtle}
          multiline
          maxLength={2000}
          style={styles.note}
          accessibilityLabel={s.note}
        />
      </SettingsGroup>

      <Text style={styles.photosTitle}>{s.photos}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {run.photos.map((name, index) => (
          <Pressable
            key={name}
            onPress={() => setViewing(name)}
            accessibilityRole="imagebutton"
            accessibilityLabel={s.photo(index + 1)}
          >
            <Image source={{ uri: photoUri(name) }} style={styles.thumb} contentFit="cover" />
          </Pressable>
        ))}
        {run.photos.length < MAX_PHOTOS ? (
          <Pressable
            onPress={() => void addPhotos()}
            accessibilityRole="button"
            accessibilityLabel={s.addPhoto}
            style={({ pressed }) => [styles.thumb, styles.addPhoto, pressed && styles.pressed]}
          >
            <Ionicons name="image-outline" size={22} color={colors.accent} />
            <Ionicons name="add" size={16} color={colors.accent} style={styles.addPlus} />
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={viewing !== null} animationType="fade" onRequestClose={() => setViewing(null)}>
        <SafeAreaView style={styles.viewer}>
          <View style={styles.viewerBar}>
            <Pressable onPress={() => setViewing(null)} accessibilityRole="button" hitSlop={10}>
              <Text style={styles.viewerAction}>{s.close}</Text>
            </Pressable>
            <Pressable
              onPress={() => viewing && removePhoto(viewing)}
              accessibilityRole="button"
              hitSlop={10}
            >
              <Text style={[styles.viewerAction, styles.viewerDanger]}>{s.removePhoto}</Text>
            </Pressable>
          </View>
          {viewing ? <Image source={{ uri: photoUri(viewing) }} style={styles.full} contentFit="contain" /> : null}
        </SafeAreaView>
      </Modal>

      <ChoiceSheet
        visible={choosingType}
        title={s.type}
        selected={run.activity}
        choices={ACTIVITY_TYPES.map((type) => ({ value: type, label: activityName(type) }))}
        onChoose={(activity) => {
          onChange({ activity });
          void setRunActivity(run.id, activity).catch(() => undefined);
        }}
        onClose={() => setChoosingType(false)}
      />

      <ChoiceSheet
        visible={choosingShoe}
        title={s.shoes}
        selected={run.shoeId}
        choices={[
          ...offered.map((held) => ({ value: held.id as number | null, label: held.name, detail: shoeLine(held) })),
          { value: null, label: s.noShoe, detail: s.noShoeDetail },
        ]}
        onChoose={(shoeId) => {
          onChange({ shoeId });
          void setRunShoe(run.id, shoeId).catch(() => undefined);
        }}
        onClose={() => setChoosingShoe(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  tag: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  tagOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  tagText: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  tagTextOn: { color: colors.accent, fontFamily: font.semibold },
  pressed: { opacity: 0.55 },
  note: {
    color: colors.text, fontSize: 16, fontFamily: font.regular, lineHeight: 21,
    minHeight: 64, paddingVertical: 12, textAlignVertical: "top",
  },
  photosTitle: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.medium, letterSpacing: 1,
    textTransform: "uppercase", marginTop: 22, marginBottom: 7, marginHorizontal: 20,
  },
  photos: { gap: 8, paddingHorizontal: 20 },
  thumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: colors.sunken },
  addPhoto: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accentSoft, backgroundColor: colors.accentSoft,
  },
  addPlus: { position: "absolute", right: 22, bottom: 22 },
  viewer: { flex: 1, backgroundColor: "#000000" },
  viewerBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  viewerAction: { color: "#ffffff", fontSize: 17, fontFamily: font.semibold },
  viewerDanger: { color: colors.danger },
  full: { flex: 1 },
});

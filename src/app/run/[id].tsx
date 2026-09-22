import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { CardMapSource, type CardMapHandle } from "@/components/CardMapSource";
import { RunMap } from "@/components/RunMap";
import { PlanAttachment } from "@/components/PlanAttachment";
import { canShareImage, ShareRunSheet } from "@/components/ShareRunSheet";
import { EXERTION_NAMES, type Exertion } from "@/lib/plan";
import { deleteRun, readRun, renameRun, type Run, setRunExertion, setRunHeart, planSessionOfRun,
} from "@/lib/db";
import {
  formatDate, formatDistance, formatDuration, formatElevation, formatEnergy, formatPace, formatSpeed,
} from "@/lib/format";
import { elevationProfile, splits, type TrackPoint } from "@/lib/geo";
import { sessionById, type RanBlock } from "@/lib/workout";
import { gpxFileName, toGpx } from "@/lib/gpx";
import { estimateActiveEnergyKcal } from "@/lib/energy";
import {
  forgetRunInHealth, healthAvailable, readBodyMassKg, readRunHeart, requestHealthAccess,
  sharingRefused, syncRunToHealth,
} from "@/lib/health";
import { formatBpm, ZONE_NAMES, type Heart } from "@/lib/heart";
import { colors, floatingShadow, font } from "@/lib/theme";
import { pendingWeather } from "@/lib/tracker";
import { formatTemperature, formatWind, weatherIcon, weatherLabel, type Weather } from "@/lib/weather";

type Loaded = { run: Run; points: TrackPoint[] };

/** One block of a session, as asked for and as run. */
function BlockRow({ block, rank }: { block: RanBlock; rank: number }) {
  const asked = block.targetMetres !== null
    ? `${block.targetMetres} m`
    : `${Math.round((block.targetSeconds ?? 0) / 60)} min`;
  const pace = block.distanceM > 0 ? (block.durationS / block.distanceM) * 1000 : null;
  const effort = block.effort === "rapide" || block.effort === "allure";

  return (
    <View style={styles.block}>
      <Text style={[styles.blockRank, effort && styles.blockEffort]}>{rank}</Text>
      <View style={styles.blockText}>
        <Text style={[styles.blockName, effort && styles.blockEffort]}>
          {asked} {block.effort}
        </Text>
        <Text style={styles.blockDone}>
          {formatDistance(block.distanceM)} km · {formatDuration(Math.round(block.durationS))}
        </Text>
      </View>
      <Text style={[styles.blockPace, effort && styles.blockEffort]}>{formatPace(pace)}</Text>
    </View>
  );
}

/**
 * The five zones as bars, longest first in time rather than in effort.
 *
 * Drawn against the zone the run spent most in rather than against the run's
 * whole duration: an hour of endurance with two minutes at threshold would
 * otherwise show four empty bars and one full one, which says nothing about
 * the two minutes. Empty zones are dropped entirely — a row of zeros is a
 * form, not a reading.
 */
function Zones({ heart }: { heart: Heart }) {
  const longest = Math.max(...heart.zonesS, 1);
  return (
    <View style={styles.zones}>
      {heart.zonesS.map((seconds, zone) =>
        seconds > 0 ? (
          <View key={zone} style={styles.zoneRow}>
            <Text style={styles.zoneName} numberOfLines={1}>
              {`Z${zone + 1} ${ZONE_NAMES[zone]}`}
            </Text>
            <View style={styles.zoneTrack}>
              <View style={[styles.zoneFill, { width: `${(seconds / longest) * 100}%` }]} />
            </View>
            <Text style={styles.zoneTime}>{formatDuration(seconds)}</Text>
          </View>
        ) : null)}
    </View>
  );
}

export default function RunDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  // undefined while loading, null when not found.
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasHealth] = useState(healthAvailable);
  const [sharingImage, setSharingImage] = useState(false);
  /** Whether the exertion has been unlocked again on this visit. */
  const [editingFeel, setEditingFeel] = useState(false);
  /** Set when this run is what ticked a session off a programme. */
  const [planLinked, setPlanLinked] = useState(false);
  const [cardMap, setCardMap] = useState<string | null>(null);
  /**
   * The reading for a run that has only just ended.
   *
   * It is fetched as the run is closed and stored a moment later, so this
   * screen — which opens in between — reads the run without it. Kept beside
   * the run rather than merged into it, because the two arrive in whichever
   * order they please and merging would have them overwrite each other.
   */
  const [lateWeather, setLateWeather] = useState<Weather | null>(null);
  // Energy needs a weight, and the app keeps none of its own.
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const cardMapSource = useRef<CardMapHandle>(null);

  // Asked once, so the warning before deleting can say what else goes with it.
  useEffect(() => {
    let active = true;
    const runId = Number(id);
    if (Number.isFinite(runId)) {
      void planSessionOfRun(runId)
        .then((linked) => active && setPlanLinked(linked !== null))
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [id]);

  // Only ever has anything to wait for when arriving straight off a run.
  useEffect(() => {
    const waiting = pendingWeather(Number(id));
    if (!waiting) return;
    let active = true;
    void waiting.then((weather) => {
      if (active && weather) setLateWeather(weather);
    });
    return () => { active = false; };
  }, [id]);

  /**
   * Ask Health what this run's heart did, whenever the run has no answer yet.
   *
   * Asked here rather than as the run is closed, and asked again on every
   * visit until it answers, because the three things it depends on arrive at
   * their own pace: a watch syncs when it feels like it, permission may be
   * granted weeks later, and a run imported from a file was never asked at
   * all. A read costs nothing and returns nothing when there is nothing —
   * which is every run by anybody who does not wear a watch.
   */
  useEffect(() => {
    if (!data || data.run.heart !== null || data.run.endedAt === null) return;
    let active = true;
    void readRunHeart(data.run.startedAt, data.run.endedAt).then((found) => {
      if (!found || !active) return;
      setData((current) => (current ? { run: { ...current.run, heart: found }, points: current.points } : current));
      void setRunHeart(Number(id), found).catch(() => undefined);
    });
    return () => { active = false; };
  }, [data, id]);

  useEffect(() => {
    let active = true;
    void readBodyMassKg().then((weight) => {
      if (active) setWeightKg(weight);
    });
    readRun(Number(id))
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (data === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Course introuvable.</Text>
      </View>
    );
  }

  const { run, points } = data;
  const weather = run.weather ?? lateWeather;
  const sky = weather === null ? null : [
    weatherLabel(weather.code),
    weather.precipitationMm >= 0.1
      ? `${weather.precipitationMm.toFixed(1).replace(".", ",")} mm`
      : null,
  ].filter(Boolean).join(" · ");
  const kilometres = splits(points);
  const profile = elevationProfile(points);

  /**
   * Close a run that was just finished, and land where it came from.
   *
   * Arriving here straight off a run left the back button as the only way
   * out, and back meant the running screen — the one place nobody wants to
   * be once they have stopped. The whole stack is dismissed rather than
   * popped, so the run screen does not flash past on the way.
   */
  /**
   * Whether the exertion may still be changed.
   *
   * Open while the run is being closed, open again on request, and always
   * open while the question has never been answered — an old run nobody
   * rated is not a settled one.
   */
  const canEditFeel = from !== undefined || editingFeel || run.exertion === null;

  function validate() {
    if (router.canDismiss()) router.dismissAll();
    router.navigate(from === "plan" ? "/plan" : "/");
  }
  const fastest = kilometres
    .filter((split) => !split.partial)
    .reduce<number | null>((best, split) => (best === null || split.durationS < best ? split.durationS : best), null);
  const fullCount = kilometres.filter((split) => !split.partial).length;
  // Null until Health has answered, and null for good if it has no weight on
  // file: an invented figure would be worse than a missing one.
  const energyKcal = weightKg === null ? null : estimateActiveEnergyKcal(run.distanceM, weightKg);

  /**
   * Writes the run as GPX into the cache and hands it to the share sheet.
   * The cache is the right home: the system reclaims it on its own, and the
   * file only needs to survive long enough to be shared.
   */
  async function exportGpx() {
    if (exporting) return;
    setExporting(true);
    try {
      const file = new File(Paths.cache, gpxFileName(run));
      file.create({ overwrite: true });
      file.write(toGpx(run, points));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/gpx+xml", UTI: "com.topografix.gpx" });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Export impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setExporting(false);
    }
  }

  /**
   * Sends this one run to Health by hand. The automatic copy only covers runs
   * finished since the setting was turned on, so everything recorded before
   * that, and anything the copy missed, needs a way in.
   */
  async function sendToHealth() {
    if (syncing) return;
    setSyncing(true);
    try {
      const asked = await requestHealthAccess();
      const uuid = asked ? await syncRunToHealth(run.id) : null;
      if (!uuid) {
        // Only one of these two is a permission problem, and telling someone
        // to go change a setting that is already right is its own small
        // betrayal.
        Alert.alert(
          "Santé n'a rien reçu",
          sharingRefused()
            ? "Tread n'a pas le droit d'écrire tes courses. Tu peux le lui donner dans Réglages › Santé › Accès aux données › Tread."
            : "L'envoi a échoué. Réessaie dans un instant.",
        );
        return;
      }
      setData({ run: { ...run, healthUuid: uuid }, points });
    } finally {
      setSyncing(false);
    }
  }

  /**
   * Draws the map for the share picture as soon as this screen has one to
   * draw, long before anyone asks to share.
   *
   * The wait is unavoidable — a map asked for its picture fetches and redraws
   * its own copy rather than reusing what is on screen, which takes a second
   * or two — but it need not be spent in front of the user. Spent here, while
   * they read their splits, it is spent for nothing they notice, and the
   * share sheet opens already finished.
   */
  function prepareCard() {
    if (cardMap || points.length === 0) return;
    void cardMapSource.current
      ?.render()
      .then(setCardMap)
      .catch(() => {
        /* the sheet will draw its own when opened */
      });
  }

  async function saveName() {
    const next = draftName.trim();
    setRenaming(false);
    if (!next || next === run.name) return;
    await renameRun(run.id, next);
    setData({ run: { ...run, name: next }, points });
  }

  /**
   * The warning before deleting, in the system's own alert.
   *
   * The same one abandoning a programme uses, and for the same reason: an
   * irreversible choice should look like every other irreversible choice on
   * the phone rather than like a part of this app. A dialog we drew
   * ourselves is a dialog people read as furniture.
   */
  function askDelete() {
    Alert.alert(
      "Supprimer cette course ?",
      "Ses points GPS seront effacés et l'action est définitive."
      + (planLinked ? " La séance correspondante redeviendra à faire dans ton programme." : ""),
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: removeRun },
      ],
    );
  }

  function removeRun() {
    // The copy in Health goes first: deleting the run here would otherwise
    // strand a workout that nothing in the app can reach any more.
    void forgetRunInHealth(run)
      .then(() => deleteRun(run.id))
      .then(() => router.back());
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Pressable
            onPress={() => {
              setDraftName(run.name ?? "");
              setRenaming(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Renommer la course"
            hitSlop={8}
            style={styles.nameRow}
          >
            <Text style={styles.name} numberOfLines={1}>{run.name ?? "Sans nom"}</Text>
            <Ionicons name="pencil" size={15} color={colors.subtle} />
          </Pressable>
          <Text style={styles.date}>{formatDate(run.startedAt)}</Text>
        </View>
        {/* Absent rather than broken where the screenshot module is: a button
            that always fails is worse than one that was never offered. */}
        {canShareImage() ? (
        <Pressable
          onPress={() => setSharingImage(true)}
          disabled={points.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Partager la course en image"
          hitSlop={10}
          style={({ pressed }) => [
            styles.share,
            points.length === 0 && styles.shareOff,
            pressed && styles.sharePressed,
          ]}
        >
          <Ionicons name="share-outline" size={19} color={colors.text} />
        </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Metric label="Distance" value={formatDistance(run.distanceM)} unit="km" large />
        <View style={styles.row}>
          <Metric label="Durée" value={formatDuration(run.durationS)} />
          <Metric label="Allure moyenne" value={formatPace(run.avgPaceSKm)} unit="/km" />
        </View>
        {run.elevationGainM !== null && (
          <View style={styles.row}>
            <Metric label="Dénivelé positif" value={formatElevation(run.elevationGainM)} unit="m" />
            {run.fastestKmS !== null ? (
              <Metric label="Meilleur km" value={formatPace(run.fastestKmS)} unit="/km" />
            ) : null}
          </View>
        )}
        <View style={styles.row}>
          <Metric
            label="Vitesse moyenne"
            value={formatSpeed(run.durationS > 0 ? run.distanceM / run.durationS : 0)}
            unit="km/h"
          />
          {energyKcal !== null ? (
            <Metric label="Calories estimées" value={formatEnergy(energyKcal)} unit="kcal" />
          ) : null}
        </View>
        {run.cadenceSpm !== null && (
          <View style={styles.row}>
            <Metric label="Cadence" value={String(run.cadenceSpm)} unit="pas/min" />
          </View>
        )}
        {/* Among the measurements rather than off in a section of its own:
            the weather is a fact about this run, the same as its dénivelé,
            and it explains an allure that the other figures alone cannot.
            Absent on runs recorded before the app knew how to ask, and on
            runs imported from a file — so nothing here is ever a placeholder
            waiting to be filled. */}
        {weather && (
          <>
            <View style={styles.row}>
              <Metric
                label="Météo"
                value={formatTemperature(weather.temperatureC)}
                unit={
                  Math.round(weather.feelsLikeC) !== Math.round(weather.temperatureC)
                    ? `ressenti ${formatTemperature(weather.feelsLikeC)}`
                    : undefined
                }
              />
              <Metric label="Vent" value={formatWind(weather.windKmh)} unit="km/h" />
            </View>
            {/* The sky in words, and the rain only when there was some.
                Absent altogether when the model gave no code: an icon beside
                an empty line reads as something that failed to load. */}
            {sky ? (
              <View style={styles.sky}>
                <Ionicons
                  name={weatherIcon(weather.code, weather.day)}
                  size={16}
                  color={colors.muted}
                />
                <Text style={styles.skyText}>{sky}</Text>
              </View>
            ) : null}
          </>
        )}
        {run.heart && (
          <View style={styles.row}>
            <Metric label="FC moyenne" value={formatBpm(run.heart.avgBpm)} unit="bpm" />
            <Metric label="FC max" value={formatBpm(run.heart.maxBpm)} unit="bpm" />
          </View>
        )}
      </View>

      {/* Its own section rather than another pair of figures: five bars are a
          shape of an effort, and the shape is the point. A steady endurance
          run and a session of intervals can share an average to the beat and
          look nothing alike here. */}
      {run.heart && run.heart.maxHeartRate !== null && run.heart.zonesS.some((s) => s > 0) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zones cardiaques</Text>
          <Zones heart={run.heart} />
          <Text style={styles.zoneNote}>
            {`Calculées sur une fréquence maximale de ${run.heart.maxHeartRate} bpm, estimée à partir de ton âge. C'est une règle générale, pas une mesure : la tienne peut s'en écarter d'une dizaine de battements.`}
          </Text>
        </View>
      ) : null}

      <RunMap
        points={points}
        fitAll
        onToggleFullscreen={() => setMapExpanded(true)}
        style={styles.map}
      />

      {points.length > 0 && (
        <CardMapSource ref={cardMapSource} points={points} onReady={prepareCard} />
      )}

      <Modal visible={mapExpanded} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <View style={styles.fullMap}>
          <RunMap
            points={points}
            fitAll
            fullscreen
            onToggleFullscreen={() => setMapExpanded(false)}
            style={styles.fullMapInner}
          />
        </View>
      </Modal>

      {/* The one thing in this screen the phone could not have measured, and
          the only way a programme ever learns it asked too much. Offered on
          every run, not only planned ones: what a run cost you is true of the
          run, whoever asked for it. */}
      <View style={styles.section}>
        <View style={styles.feelHead}>
          <Text style={styles.sectionTitle}>Ressenti</Text>
          {/* Settled once the run has been closed, and reopened on request.
              An answer given at the end of a run is the honest one; the same
              answer revisited a fortnight later, next to the splits and the
              records, is a memory arguing with itself. Locked rather than
              frozen, because a mistaken tap deserves a way back and the app
              has no business deciding you were wrong about your own legs. */}
          {from === undefined && run.exertion !== null ? (
            <Pressable
              onPress={() => setEditingFeel((on) => !on)}
              accessibilityRole="button"
              hitSlop={10}
              style={({ pressed }) => [pressed && styles.sharePressed]}
            >
              {/* A toggle, not a one-way door. Opening the answer without
                  offering a way to close it again left the only exit through
                  the back button, which reads as the app having got stuck.
                  Each tap is already saved, so this settles rather than
                  commits. */}
              <Text style={styles.feelEdit}>{editingFeel ? "Terminer" : "Modifier"}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.feelRow}>
          {([1, 2, 3, 4, 5] as const).map((level) => {
            const on = run.exertion === level;
            return (
              <Pressable
                key={level}
                disabled={!canEditFeel}
                onPress={() => {
                  // Tapping the answer already given takes it back, so a
                  // mistaken tap is not permanent.
                  const next: Exertion | null = on ? null : level;
                  setData({ run: { ...run, exertion: next }, points });
                  void setRunExertion(run.id, next).catch(() => undefined);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={EXERTION_NAMES[level]}
                style={({ pressed }) => [
                  styles.feel,
                  on && styles.feelOn,
                  !canEditFeel && !on && styles.feelLocked,
                  pressed && styles.sharePressed,
                ]}
              >
                <Text style={[styles.feelLabel, on && styles.feelLabelOn]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.feelName}>
          {run.exertion === null
            ? "Comment c'était ? Deux séances dures d'affilée et ton programme s'allège."
            : EXERTION_NAMES[run.exertion]}
        </Text>
      </View>

      {/* Right under the exertion, because both answer the same question in
          different words: what this run was, beyond the numbers the phone
          collected by itself. */}
      <PlanAttachment
        runId={run.id}
        durationS={run.durationS}
        // The delete warning has to know too: detaching here changes what
        // deleting the run would give back.
        onChange={() => {
          void planSessionOfRun(run.id)
            .then((linked) => setPlanLinked(linked !== null))
            .catch(() => undefined);
        }}
      />

      {profile.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          {/* Drawn as columns from the lowest point of the run rather than
              from sea level: a hundred metres of climbing matters, the
              altitude it happened at does not. */}
          <View style={styles.profile}>
            {profile.map((point, i) => {
              const low = Math.min(...profile.map((p) => p.altitudeM));
              const high = Math.max(...profile.map((p) => p.altitudeM));
              const share = (point.altitudeM - low) / Math.max(1, high - low);
              return (
                <View key={i} style={styles.profileSlot}>
                  <View style={[styles.profileBar, { height: `${8 + share * 92}%` }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.profileScale}>
            <Text style={styles.profileMark}>
              {formatElevation(Math.min(...profile.map((p) => p.altitudeM)))} m
            </Text>
            <Text style={styles.profileMark}>
              {formatElevation(Math.max(...profile.map((p) => p.altitudeM)))} m
            </Text>
          </View>
        </View>
      )}

      {run.blocks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {sessionById(run.sessionId)?.name ?? "Séance"}
          </Text>
          {/* Each block beside what it asked for. A repetition is only worth
              reading next to its target: four hundred metres in 1:32 means
              nothing until you know four hundred were the point. */}
          {run.blocks.map((block, index) => (
            <BlockRow key={index} block={block} rank={index + 1} />
          ))}
        </View>
      )}

      {kilometres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fractionnés</Text>
          {kilometres.map((split) => {
            const pace = split.durationS / (split.distanceM / 1000);
            const isBest = !split.partial && fastest !== null && split.durationS === fastest && fullCount > 1;
            return (
              <View key={split.km} style={styles.split}>
                <Text style={styles.splitKm}>
                  {split.partial ? `${formatDistance(split.distanceM)} km` : `km ${split.km}`}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${Math.min(100, ((fastest ?? pace) / pace) * 100)}%` },
                      isBest && styles.barBest,
                    ]}
                  />
                </View>
                <Text style={[styles.splitPace, isBest && styles.best]}>{formatPace(pace)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footnotes}>
        <Text style={styles.muted}>{points.length} points GPS enregistrés</Text>
        {hasHealth && run.healthUuid && (
          <View style={styles.synced}>
            <Ionicons name="heart" size={12} color={colors.accent} />
            <Text style={styles.syncedText}>Copiée dans Apple Santé</Text>
          </View>
        )}
      </View>

      {hasHealth && !run.healthUuid && (
        <View style={styles.wideAction}>
          <Button
            label={syncing ? "Envoi…" : "Ajouter à Apple Santé"}
            variant="secondary"
            onPress={() => void sendToHealth()}
            disabled={syncing}
          />
        </View>
      )}

      {/* Only for a run just finished. Opened from the history or the plan,
          the sheet is something you leave by going back, and a button
          claiming to validate what is already recorded would be noise. */}
      {from ? (
        <View style={styles.validate}>
          <Button label="Valider" onPress={validate} disabled={run.exertion === null} />
          {run.exertion === null ? (
            <Text style={styles.validateHint}>
              {"Dis d'abord comment c'était : c'est la seule chose que ton programme ne peut pas deviner."}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={exporting ? "Export…" : "Exporter en GPX"}
          variant="secondary"
          onPress={() => void exportGpx()}
          disabled={exporting || points.length === 0}
        />
        <Button label="Supprimer" variant="danger" onPress={askDelete} />
      </View>

      <ShareRunSheet
        visible={sharingImage}
        // The run as it now stands rather than as it was read off disk: a
        // reading that arrived after the screen opened belongs on the picture
        // too, and the card is drawn from whatever it is handed.
        run={weather === run.weather ? run : { ...run, weather }}
        points={points}
        preparedMapUri={cardMap}
        onClose={() => setSharingImage(false)}
      />


      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRenaming(false)}>
          {/* Stops a tap inside the card from closing it. */}
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>Nom de la course</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Course matinale"
              placeholderTextColor={colors.subtle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
              style={styles.input}
            />
            <View style={styles.dialogActions}>
              <Button label="Annuler" variant="secondary" onPress={() => setRenaming(false)} />
              <Button label="Enregistrer" onPress={() => void saveName()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background,
  },

  heading: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 13,
  },
  headingText: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Same ring as the history's export button, so the two read as the same
  // kind of control rather than as two unrelated icons.
  share: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  shareOff: { opacity: 0.35 },
  sharePressed: { backgroundColor: colors.sunken },
  name: { color: colors.text, fontSize: 27, fontFamily: font.bold, letterSpacing: -0.6 },
  date: { color: colors.subtle, fontSize: 14.5 },

  // Set apart from the export and delete pair below it: closing a run and
  // disposing of one are not the same kind of act, and a button stacked
  // against those two reads as a third member of the group.
  validate: {
    paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 22, gap: 7,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  validateHint: {
    color: colors.subtle, fontFamily: font.regular, fontSize: 13,
    lineHeight: 18, textAlign: "center",
  },
  feelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feelEdit: { color: colors.accent, fontSize: 13, fontFamily: font.semibold },
  feelRow: { flexDirection: "row", gap: 8, paddingTop: 2 },
  feelLocked: { borderColor: "transparent", opacity: 0.45 },
  feel: {
    flex: 1, aspectRatio: 1.6, alignItems: "center", justifyContent: "center", borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  feelOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  feelLabel: { color: colors.muted, fontSize: 15.5, fontFamily: font.semibold },
  feelLabelOn: { color: colors.accentText },
  feelName: { color: colors.subtle, fontSize: 12.5, fontFamily: font.regular, paddingTop: 6 },

  profile: {
    flexDirection: "row", alignItems: "flex-end", gap: 1, height: 68, paddingTop: 4,
  },
  profileSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  profileBar: { width: "100%", backgroundColor: colors.accentSoft, borderRadius: 1 },
  profileScale: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  profileMark: {
    color: colors.subtle, fontSize: 11, fontFamily: font.regular, fontVariant: ["tabular-nums"],
  },

  section: {
    paddingHorizontal: GUTTER, paddingVertical: 15, gap: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  sectionTitle: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold,
    letterSpacing: 1.3, textTransform: "uppercase",
  },
  row: { flexDirection: "row", gap: 16 },
  zones: { gap: 7 },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Stated rather than shared: the five names have to line their bars up with
  // one another, and a column that sizes itself to its text would step in and
  // out down the list.
  zoneName: { width: 108, color: colors.muted, fontSize: 14, fontFamily: font.medium },
  zoneTrack: { flex: 1, height: 7, borderRadius: 3.5, backgroundColor: colors.sunken },
  zoneFill: { height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  zoneTime: {
    width: 52, textAlign: "right", color: colors.text, fontSize: 14,
    fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
  zoneNote: { color: colors.subtle, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },

  sky: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: -2 },
  skyText: { color: colors.muted, fontFamily: font.medium, fontSize: 15.5 },

  map: { height: 260, borderRadius: 0, marginTop: 4 },
  fullMap: { flex: 1, backgroundColor: colors.background },
  fullMapInner: { flex: 1, borderRadius: 0 },

  block: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 5 },
  // The number anchors the row: mid-list, a repetition is found by its rank
  // before it is found by its name.
  blockRank: {
    color: colors.subtle, width: 19, fontSize: 12.5,
    fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
  blockText: { flex: 1, gap: 1 },
  blockName: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  blockDone: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  blockPace: {
    color: colors.text, fontSize: 14, fontFamily: font.semibold,
    fontVariant: ["tabular-nums"],
  },
  // Only the efforts are tinted. Warm-ups and recoveries are there to be run,
  // not to be read.
  blockEffort: { color: colors.accent },

  split: { flexDirection: "row", alignItems: "center", gap: 12 },
  splitKm: { color: colors.muted, width: 52, fontFamily: font.regular, fontSize: 14, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.sunken, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.accentSoft },
  barBest: { backgroundColor: colors.accent },
  splitPace: {
    color: colors.text, width: 52, textAlign: "right",
    fontSize: 15.5, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
  best: { color: colors.accent },

  footnotes: { alignItems: "center", gap: 4, paddingVertical: 13 },
  muted: { color: colors.subtle, fontFamily: font.regular, fontSize: 13.5, textAlign: "center" },
  synced: { flexDirection: "row", alignItems: "center", gap: 5 },
  syncedText: { color: colors.accent, fontSize: 13.5, fontFamily: font.medium },
  wideAction: { paddingHorizontal: GUTTER, paddingBottom: 10 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: GUTTER },

  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 28,
  },
  dialog: {
    width: "100%", backgroundColor: colors.background, borderRadius: 10, padding: 20, gap: 14,
    ...floatingShadow,
  },
  dialogTitle: { color: colors.text, fontSize: 19, fontFamily: font.bold },
  input: {
    backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 11,
    fontFamily: font.regular, fontSize: 17, color: colors.text, borderWidth: 1, borderColor: colors.hairline,
  },
  dialogActions: { flexDirection: "row", gap: 10 },
});

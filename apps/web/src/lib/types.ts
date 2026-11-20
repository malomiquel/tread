import type { ActivityType } from "@tread/core/activity";
import type { BestEfforts } from "@tread/core/efforts";
import type { TrackPoint } from "@tread/core/geo";
import type { Heart } from "@tread/core/heart";
import type { LapMark } from "@tread/core/laps";
import type { Exertion } from "@tread/core/plan";
import type { RoutePoint } from "@tread/core/route";
import type { TransferPlan } from "@tread/core/transfer";
import type { Weather } from "@tread/core/weather";
import type { RanBlock } from "@tread/core/workout";

/**
 * What the server hands the pages: plain data, times in milliseconds, so it
 * crosses from a server component to a client one as it is.
 */

/** An outing as a list shows it, without its track. */
export interface OutingRow {
  id: string;
  startedAt: number;
  activity: ActivityType;
  name: string | null;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  elevationGainM: number | null;
  /** [lat, lng] pairs. */
  shape: [number, number][];
}

/** One outing, everything about it. */
export interface OutingDetail extends OutingRow {
  endedAt: number | null;
  fastestKmS: number | null;
  cadenceSpm: number | null;
  exertion: Exertion | null;
  sessionId: string | null;
  shoeName: string | null;
  tags: string[];
  note: string | null;
  blocks: RanBlock[];
  laps: LapMark[];
  weather: Weather | null;
  heart: Heart | null;
  points: TrackPoint[];
}

/** An outing as the profile counts it. */
export interface OutingFigures extends OutingRow {
  efforts: BestEfforts | null;
  shoeRef: number | null;
}

/**
 * An outing as its card reads it: what `@tread/core/card` deals from, with
 * the outline to draw on the card. No track.
 */
export interface CardOuting extends OutingRow {
  endedAt: number | null;
  fastestKmS: number | null;
  exertion: Exertion | null;
  sessionId: string | null;
  tags: string[];
  blocks: RanBlock[];
  weather: Weather | null;
  efforts: BestEfforts | null;
  /** The route it followed, by the phone's number for it, or null. */
  routeRef: number | null;
}

export interface RouteRow {
  id: string;
  name: string;
  createdAt: number;
  place: string | null;
  /** The whole line, legs joined. */
  line: RoutePoint[];
}

export interface ShoeRow {
  ref: number;
  name: string;
  addedAt: number;
  startM: number;
  limitM: number;
  retired: boolean;
  isDefault: boolean;
}

/** The phone's settings as stored there, and when it last sent them. */
export interface Preferences {
  settings: Record<string, string>;
  syncedAt: number | null;
}

export type PlanData = TransferPlan;

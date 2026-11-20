import { Directory, File, Paths } from "expo-file-system";

/**
 * The picture kept of a route, in pixels.
 *
 * Wide, because it is shown across a list row, and taken at this size once
 * rather than drawn live on every row: a map per row would want tiles, a
 * network and a view of its own for each of them.
 */
export const PREVIEW = { width: 800, height: 340 };

/**
 * Move a freshly taken map snapshot somewhere it will still be tomorrow.
 *
 * A snapshot lands in the system's temporary directory, which is exactly the
 * directory the system empties when it wants the space back. A picture meant
 * to outlive the afternoon has to be moved somewhere the phone has promised
 * to keep, and the documents directory is that promise.
 */
export function keepPicture(from: string): string {
  const folder = new Directory(Paths.document, "routes");
  if (!folder.exists) folder.create({ intermediates: true });

  const file = new File(from.startsWith("file://") ? from : `file://${from}`);
  const kept = new File(folder, `${Date.now()}-${Math.round(Math.random() * 1e6)}.png`);
  file.move(kept);
  return kept.uri;
}

/**
 * Where a kept route picture is now, or null when it is gone.
 *
 * iOS moves the app's folder on every install and update, so a full path
 * written down yesterday points nowhere today. Only the file's name is
 * trusted, read against wherever the documents directory is now; a picture
 * that is really gone gives null, and the route is photographed again.
 */
export function pictureUri(stored: string | null): string | null {
  if (!stored) return null;
  const name = stored.split("/").pop();
  if (!name) return null;
  try {
    const file = new File(new Directory(Paths.document, "routes"), name);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

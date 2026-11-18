import { Directory, File, Paths } from "expo-file-system";

/**
 * Photos added to runs, kept in the app's own documents.
 *
 * Copied in rather than pointed at in the photo library: a photo deleted
 * from the camera roll a month later should not leave a hole in a run. Only
 * the file name is stored with the run, never the full path — the app's
 * folder moves between installs, and a path written today points nowhere
 * after an update.
 */

/** Photos a run may carry: a handful to remember it by, not an album. */
export const MAX_PHOTOS = 6;

function folder(): Directory {
  const photos = new Directory(Paths.document, "photos");
  if (!photos.exists) photos.create({ intermediates: true });
  return photos;
}

/** Where a stored photo is now, for an image to show. */
export const photoUri = (name: string): string => new File(folder(), name).uri;

/** Copy a picked photo into the app, and return the name to store. */
export function keepPhoto(runId: number, from: string): string {
  const extension = from.split("?")[0].split(".").pop()?.toLowerCase();
  const name = `${runId}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${extension && extension.length <= 4 ? extension : "jpg"}`;
  new File(from).copy(new File(folder(), name));
  return name;
}

/** Remove photos from the app. Silent: a file that will not go is not worth an error. */
export function forgetPhotos(names: readonly string[]): void {
  for (const name of names) {
    try {
      const file = new File(folder(), name);
      if (file.exists) file.delete();
    } catch {
      /* already gone, or not ours to delete */
    }
  }
}

/** Stored photo names, or none for anything unreadable. */
export function parsePhotos(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
}

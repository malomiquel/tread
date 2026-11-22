import { requireOptionalNativeModule } from "expo";

interface ZipFileModule {
  /**
   * Write a zip at `targetUri` holding one entry, `entryName`, with the
   * contents of the file at `sourceUri`, deflated. Both are `file://` URIs.
   * Runs on a native queue: the JavaScript thread only waits for the answer.
   */
  zipFile(sourceUri: string, entryName: string, targetUri: string): Promise<void>;
}

/**
 * null wherever the native side is absent (Expo Go, a build made before this
 * module existed): callers then zip in JavaScript as they always did.
 */
export default requireOptionalNativeModule<ZipFileModule>("ZipFile");

package expo.modules.zipfile

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** One file into a zip, deflated by the platform, off the JavaScript thread. */
class ZipFileModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZipFile")

    AsyncFunction("zipFile") { sourceUri: String, entryName: String, targetUri: String ->
      val source = File(requireNotNull(Uri.parse(sourceUri).path) { "bad source" })
      val target = File(requireNotNull(Uri.parse(targetUri).path) { "bad target" })
      ZipOutputStream(BufferedOutputStream(FileOutputStream(target))).use { zip ->
        zip.putNextEntry(ZipEntry(entryName))
        source.inputStream().use { it.copyTo(zip, 1 shl 16) }
        zip.closeEntry()
      }
    }
  }
}

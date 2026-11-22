import Compression
import ExpoModulesCore
import Foundation

/**
 A zip of one file, written by hand: iOS can deflate (the Compression
 framework's zlib is raw DEFLATE, which is what a zip holds) but has no public
 API that writes a zip archive. One entry, no ZIP64: a safety copy is a few
 megabytes, far from the 4 GB where the plain format stops.
 */
public class ZipFileModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZipFile")

    // Expo runs async functions off the JavaScript thread.
    AsyncFunction("zipFile") { (sourceUri: String, entryName: String, targetUri: String) in
      try zip(source: try fileURL(sourceUri), entryName: entryName, target: try fileURL(targetUri))
    }
  }
}

private struct BadURI: Error {}

private func fileURL(_ uri: String) throws -> URL {
  guard let url = URL(string: uri), url.isFileURL else { throw BadURI() }
  return url
}

private let crcTable: [UInt32] = (0..<256).map { index in
  var value = UInt32(index)
  for _ in 0..<8 { value = (value & 1) != 0 ? 0xEDB88320 ^ (value >> 1) : value >> 1 }
  return value
}

private func crc32(_ crc: UInt32, _ data: Data) -> UInt32 {
  var value = ~crc
  data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
    for byte in bytes { value = crcTable[Int((value ^ UInt32(byte)) & 0xFF)] ^ (value >> 8) }
  }
  return ~value
}

private extension Data {
  mutating func append16(_ value: UInt16) { Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) } }
  mutating func append32(_ value: UInt32) { Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) } }
}

/** The DOS date and time a zip entry carries. */
private func dosStamp(_ date: Date) -> (time: UInt16, date: UInt16) {
  let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
  let time = UInt16((parts.hour ?? 0) << 11 | (parts.minute ?? 0) << 5 | (parts.second ?? 0) / 2)
  let day = UInt16(max((parts.year ?? 1980) - 1980, 0) << 9 | (parts.month ?? 1) << 5 | (parts.day ?? 1))
  return (time, day)
}

private func localHeader(name: Data, crc: UInt32, compressed: UInt32, size: UInt32, stamp: (time: UInt16, date: UInt16)) -> Data {
  var header = Data()
  header.append32(0x04034B50)
  header.append16(20) // version needed: deflate
  header.append16(0x0800) // the name is UTF-8
  header.append16(8) // deflate
  header.append16(stamp.time)
  header.append16(stamp.date)
  header.append32(crc)
  header.append32(compressed)
  header.append32(size)
  header.append16(UInt16(name.count))
  header.append16(0)
  header.append(name)
  return header
}

private func zip(source: URL, entryName: String, target: URL) throws {
  let name = Data(entryName.utf8)
  let stamp = dosStamp(Date())
  let manager = FileManager.default
  if manager.fileExists(atPath: target.path) { try manager.removeItem(at: target) }
  manager.createFile(atPath: target.path, contents: nil)

  let input = try FileHandle(forReadingFrom: source)
  defer { try? input.close() }
  let output = try FileHandle(forWritingTo: target)
  defer { try? output.close() }

  // A header with the sizes still unknown, filled in once the data is written.
  try output.write(contentsOf: localHeader(name: name, crc: 0, compressed: 0, size: 0, stamp: stamp))

  var crc: UInt32 = 0
  var size: UInt64 = 0
  var compressed: UInt64 = 0
  let filter = try OutputFilter(.compress, using: .zlib) { chunk in
    guard let chunk else { return }
    try output.write(contentsOf: chunk)
    compressed += UInt64(chunk.count)
  }
  while let chunk = try input.read(upToCount: 1 << 16), !chunk.isEmpty {
    crc = crc32(crc, chunk)
    size += UInt64(chunk.count)
    try filter.write(chunk)
  }
  try filter.finalize()

  struct TooLarge: Error {}
  guard size < UInt64(UInt32.max), compressed < UInt64(UInt32.max) else { throw TooLarge() }

  let centralOffset = UInt32(30 + name.count) + UInt32(compressed)
  var central = Data()
  central.append32(0x02014B50)
  central.append16(20) // made by
  central.append16(20) // version needed
  central.append16(0x0800)
  central.append16(8)
  central.append16(stamp.time)
  central.append16(stamp.date)
  central.append32(crc)
  central.append32(UInt32(compressed))
  central.append32(UInt32(size))
  central.append16(UInt16(name.count))
  central.append16(0) // extra
  central.append16(0) // comment
  central.append16(0) // disk
  central.append16(0) // internal attributes
  central.append32(0) // external attributes
  central.append32(0) // offset of the local header
  central.append(name)

  var end = Data()
  end.append32(0x06054B50)
  end.append16(0)
  end.append16(0)
  end.append16(1)
  end.append16(1)
  end.append32(UInt32(central.count))
  end.append32(centralOffset)
  end.append16(0)

  try output.write(contentsOf: central)
  try output.write(contentsOf: end)
  try output.seek(toOffset: 0)
  try output.write(contentsOf: localHeader(name: name, crc: crc, compressed: UInt32(compressed), size: UInt32(size), stamp: stamp))
}

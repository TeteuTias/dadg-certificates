import { inflateRawSync } from "node:zlib";
import { ClamError } from "../domain";

/** Validate the central directory AND actual inflated lengths before ExcelJS parses XML. */
export function checkXlsxArchive(buffer: Buffer) {
  const maxExpanded = 100 * 1024 * 1024;
  const invalid = () => new ClamError("INVALID_XLSX", 400);
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  }
  if (
    end < 0 ||
    buffer.readUInt16LE(end + 4) !== 0 ||
    buffer.readUInt16LE(end + 6) !== 0
  )
    throw invalid();
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  if (
    !count ||
    count > 1000 ||
    cursor + buffer.readUInt32LE(end + 12) !== end ||
    count !== buffer.readUInt16LE(end + 8)
  )
    throw invalid();
  let total = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw invalid();
    const flags = buffer.readUInt16LE(cursor + 8),
      method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20),
      expanded = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28),
      extra = buffer.readUInt16LE(cursor + 30),
      comment = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      local + 30 > cursor ||
      cursor + 46 + nameLength + extra + comment > end
    )
      throw invalid();
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    if (!name || names.has(name) || name.includes("..") || name.startsWith("/"))
      throw invalid();
    names.add(name);
    total += expanded;
    if (total > maxExpanded) throw new ClamError("FILE_TOO_LARGE", 400);
    if (
      buffer.readUInt32LE(local) !== 0x04034b50 ||
      buffer.readUInt16LE(local + 8) !== method
    )
      throw invalid();
    const localNameLength = buffer.readUInt16LE(local + 26);
    const start =
      local + 30 + localNameLength + buffer.readUInt16LE(local + 28);
    if (
      start + compressed > cursor ||
      !buffer
        .subarray(local + 30, local + 30 + localNameLength)
        .equals(buffer.subarray(cursor + 46, cursor + 46 + nameLength))
    )
      throw invalid();
    try {
      const bytes = buffer.subarray(start, start + compressed);
      const actual =
        method === 0
          ? bytes.length
          : inflateRawSync(bytes, { maxOutputLength: Math.max(1, expanded) })
              .length;
      if (actual !== expanded) throw invalid();
    } catch {
      throw invalid();
    }
    cursor += 46 + nameLength + extra + comment;
  }
  if (
    cursor !== end ||
    !names.has("[Content_Types].xml") ||
    !names.has("xl/workbook.xml")
  )
    throw invalid();
}

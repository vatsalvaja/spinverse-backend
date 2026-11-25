import { inflateRawSync } from 'node:zlib';
import { ZipEntry, ZipReadResult } from '../interfaces/zip.interface';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const MODE_TYPE_MASK = 0o170000;
const MODE_SYMLINK = 0o120000;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Reads the structure of a ZIP archive held in memory.
 *
 * It never throws for a bad archive: problems are returned in `errors`. Entries are inflated
 * lazily by `read()`, which refuses to produce more bytes than the entry declares (so a zip
 * bomb cannot expand beyond the declared size) and verifies size and CRC-32.
 * ZIP64, encrypted entries and symbolic links are rejected.
 */
export function readZip(buf: Buffer, limits: { maxEntries: number; maxTotalBytes: number }): ZipReadResult {
  const errors: string[] = [];
  const entries: ZipEntry[] = [];

  if (buf.length < 22 || buf.readUInt32LE(0) !== SIG_LOCAL) {
    return { entries, errors: ['Not a ZIP archive: missing the ZIP signature.'] };
  }

  // End-of-central-directory record: scan backwards (it may be followed by a comment of up to 64 KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    return { entries, errors: ['The archive is truncated or corrupt: no end-of-central-directory record.'] };
  }

  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return { entries, errors: ['ZIP64 archives are not supported.'] };
  }
  if (cdOffset + cdSize > eocd) {
    return { entries, errors: ['The central directory points outside the archive.'] };
  }
  if (count > limits.maxEntries) {
    return { entries, errors: [`The archive has ${count} entries; the limit is ${limits.maxEntries}.`] };
  }

  const seen = new Set<string>();
  let declaredTotal = 0;
  let p = cdOffset;

  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) {
      errors.push(`Central directory entry ${n + 1} is damaged.`);
      break;
    }
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    const attributes = buf.readUInt32LE(p + 38) >>> 16;
    const headerOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue; // directory marker
    if (seen.has(name)) errors.push(`Duplicate entry "${name}".`);
    seen.add(name);
    if (flags & 1) {
      errors.push(`"${name}" is encrypted.`);
      continue;
    }
    if ((attributes & MODE_TYPE_MASK) === MODE_SYMLINK) {
      errors.push(`"${name}" is a symbolic link.`);
      continue;
    }
    if (method !== 0 && method !== 8) {
      errors.push(`"${name}" uses unsupported compression method ${method}.`);
      continue;
    }
    if (headerOffset + 30 > buf.length || buf.readUInt32LE(headerOffset) !== SIG_LOCAL) {
      errors.push(`"${name}": local header is damaged.`);
      continue;
    }
    const dataStart = headerOffset + 30 + buf.readUInt16LE(headerOffset + 26) + buf.readUInt16LE(headerOffset + 28);
    if (dataStart + compressedSize > cdOffset) {
      errors.push(`"${name}": data runs past the central directory.`);
      continue;
    }

    declaredTotal += size;
    if (declaredTotal > limits.maxTotalBytes) {
      errors.push('The declared unpacked size of the archive exceeds the package limit.');
      break;
    }

    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    entries.push({
      path: name,
      size,
      read: () => {
        // maxOutputLength stops a decompression bomb from growing past the declared size
        const data = method === 8 ? inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) }) : Buffer.from(raw);
        if (data.length !== size) throw new Error(`"${name}": size mismatch (expected ${size} bytes, got ${data.length}).`);
        if (crc32(data) !== crc) throw new Error(`"${name}": CRC-32 mismatch, the data is corrupt.`);
        return data;
      },
    });
  }

  return { entries, errors };
}

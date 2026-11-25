export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  path: string;
  /** Declared uncompressed size in bytes. */
  size: number;
  /** Inflates the entry and verifies size and CRC-32. Throws if the data is corrupt. */
  read(): Buffer;
}

export interface ZipReadResult {
  entries: ZipEntry[];
  /** Structural problems (not a ZIP, truncated, encrypted entries, symlinks, ...). */
  errors: string[];
}

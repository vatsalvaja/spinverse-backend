/** The nine checks shown in the admin "Validate package" panel. */
export type ValidationCheckId =
  | 'zip-format'
  | 'package-size'
  | 'manifest-present'
  | 'manifest-fields'
  | 'game-id'
  | 'version'
  | 'entry-html'
  | 'assets'
  | 'structure';

export type CheckState = 'passed' | 'failed' | 'warning';

export interface ValidationCheck {
  id: ValidationCheckId;
  label: string;
  state: CheckState;
  /** First problem found for this check, if any. */
  detail: string | null;
}

export interface PackageManifest {
  gameId: string;
  name: string;
  version: string;
  entryPoint: string;
  description: string;
  assets: { thumbnail: string; images?: string; audio?: string };
  compatibility: {
    minBrowser: string;
    platforms: string[];
    orientation: string;
    minClientVersion?: string;
  };
  [key: string]: unknown;
}

export interface PackageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: ValidationCheck[];
  /** Present only when the manifest could be read and is structurally valid. */
  manifest: PackageManifest | null;
  fileCount: number;
  unpackedBytes: number;
}

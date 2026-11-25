/**
 * The game package contract.
 *
 * This is a server-side copy of the frontend's single source of truth,
 * `spinverse/src/features/game-management/lib/package-contract.json`, which the admin
 * UI and the Package Builder (`npm run package`) also use. The numbers and rules below
 * must stay identical to that file.
 */
export const PACKAGE_CONTRACT = {
  /** Largest allowed package, both as a ZIP and unpacked. */
  maxPackageBytes: 262144000,
  /** Above this unpacked size a warning is added. */
  warnPackageBytes: 157286400,
  manifest: {
    fileName: 'manifest.json',
    requiredFields: ['gameId', 'name', 'version', 'entryPoint', 'description', 'assets', 'compatibility'],
    gameIdPattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    gameIdMinLength: 3,
    gameIdMaxLength: 40,
    versionPattern: /^\d+\.\d+\.\d+$/,
    descriptionMaxLength: 160,
    platforms: ['desktop', 'tablet', 'mobile'],
    orientations: ['landscape', 'portrait', 'both'],
    thumbnailExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
  },
  structure: {
    forbiddenDirectories: ['node_modules', '.git', '.github', '.vscode', 'server', 'backend', '__MACOSX'],
    forbiddenFileNames: [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'npm-shrinkwrap.json',
      'Dockerfile',
      'docker-compose.yml',
    ],
    forbiddenFilePrefixes: ['.env'],
    forbiddenExtensions: [
      '.map', '.pem', '.key', '.p12', '.pfx', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.scss', '.sass',
      '.less', '.php', '.py', '.rb', '.java', '.go', '.cs', '.jsp', '.asp', '.aspx', '.sh', '.bat', '.cmd',
      '.ps1', '.sql', '.db', '.sqlite', '.log', '.tmp', '.swp',
    ],
    ignoredFileNames: ['.DS_Store', 'Thumbs.db', 'desktop.ini'],
  },
};

/** Limits of the ZIP reader itself (protection against zip bombs and absurd archives). */
export const ZIP_LIMITS = {
  maxEntries: 20000,
  /** Text files larger than this are not scanned for secrets / absolute URLs. */
  scanMaxBytes: 20 * 1024 * 1024,
};

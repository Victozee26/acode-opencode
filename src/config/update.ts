// Command to read the currently installed opencode CLI version (V1 and V2).
export const VERSION_CHECK_COMMAND = 'opencode --version';

// Command to query the latest available V2 version from npm. V1 installs check
// against this track too, so the update button migrates V1 → V2 in one press.
export const LATEST_VERSION_COMMAND = 'npm view @opencode/cli version';

// Command to install (or update) the V2 npm package globally.
export const INSTALL_UPDATE_COMMAND = 'npm install -g @opencode/cli';

// Best-effort removal of the legacy V1 package before installing the V2 one,
// so an update press migrates instead of leaving both packages behind.
// Failures are ignored (the package may simply not be installed).
export const UNINSTALL_V1_COMMAND = 'npm uninstall -g opencode-ai';

// Same update for npm builds that gate dependency lifecycle scripts behind an
// explicit opt-in (`--allow-scripts`, npm >= NPM_ALLOW_SCRIPTS_MIN_VERSION in
// `config/opencode.ts`).
export const INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS =
  'npm install -g --allow-scripts=@opencode/cli @opencode/cli';

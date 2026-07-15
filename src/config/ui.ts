// Spinner animation: degrees rotated per second. The rAF loop advances by
// exactly this many degrees per second using wall-clock delta time, so the
// visual speed stays constant regardless of actual frame timing.
export const SPINNER_DEG_PER_SEC = 450;

// Spinner animation: reference frame rate (unused since switching to rAF).
// Kept as documentation of the intended target rate.
export const SPINNER_FPS = 30;

// Floating action button: milliseconds of pointer inactivity before the button
// fades to a reduced opacity (so it stays out of the way during reading).
export const FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT = 5000;

// Floating action button scrim/backdrop overlay shown while the menu is open:
// a full-viewport dimmed + blurred layer that closes the menu when tapped.
export const FAB_SCRIM_BACKGROUND = 'rgba(0, 0, 0, 0.45)';
export const FAB_SCRIM_BLUR = '4px';
// Scrim is a child of the FAB element with a negative z-index, so it shares the
// FAB's stacking context and always paints BEHIND the button (and its menu) yet
// above page content. A separate root-level scrim would paint above the FAB
// subtree (because $page forms its own stacking context), stealing the click.
export const FAB_SCRIM_Z_INDEX = -1;
export const FAB_Z_INDEX = 1001;

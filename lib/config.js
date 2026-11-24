// Edit this file to change what Orange reports. Restart the dev server after saving.

// Checks that are switched off. They are never reported, counted, scored, or exported.
export const DISABLED_CHECKS = [
  "title-long",     // Title is too long
  "desc-long",      // Meta description is too long
  "slow-load",      // Slow page load (over 3 seconds, needs "Run JavaScript")
  "slow-response",  // Slow server response (over 2.5 seconds), the plain-fetch version of the same check
  "slow-ttfb",      // Slow time to first byte (over 800 ms)
];

// Change how serious a check is: "error", "warning", or "notice". Errors count most toward the score.
export const SEVERITY = {
  "heading-skip": "error", // Heading levels are skipped
  "h1-multiple": "error",  // More than one H1 heading
  "dup-desc": "error",     // Same meta description as another page
};

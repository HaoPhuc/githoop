// Loading-screen pun bank — basketball × git. Pure data + a deterministic
// rotation helper so the loading screen stays lively without randomness.
export const PUNS: readonly string[] = [
  "Measuring your assists (pull requests)…",
  "Checking your shooting range (repo stars)…",
  "Reviewing the instant replay (git log)…",
  "Counting your blocks (code reviews)…",
  "Reviewing the tape (your commit history)…",
  "Assessing your handles (language range)…",
  "Timing your sprints (and your sprints)…",
  "Drawing up a play (merge strategy)…",
  "Checking your draft stock (star count)…",
  "Inspecting your stamina (contribution streak)…",
  "Reading your outlet passes (pull requests)…",
  "Grading your work rate (commits per night)…",
];

// Stable line for a given tick — callers advance `tick` on an interval.
export function punAt(tick: number): string {
  return PUNS[((tick % PUNS.length) + PUNS.length) % PUNS.length];
}

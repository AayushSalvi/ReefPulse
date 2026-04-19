/**
 * Demo challenges — time-boxed goals, completion badges, cumulative trophies.
 * Replace with API data in production.
 */

/** @typedef {{ id: string; title: string; icon: string; theme: string; blurb: string; durationDays: number; progressPct: number; completed: boolean; badgeName: string; points: number }} Challenge */

/** @type {Challenge[]} */
export const challenges = [
  {
    id: "eco-shore-clean",
    title: "Shoreline guardian",
    icon: "shore-wave",
    theme: "environmental",
    blurb: "Log 3 beach visits with a photo and one piece of debris removed or reported.",
    durationDays: 14,
    progressPct: 66,
    completed: false,
    badgeName: "Tide line steward",
    points: 50
  },
  {
    id: "species-bingo",
    title: "New fins bingo",
    icon: "fish-school",
    theme: "discovery",
    blurb: "Spot 5 species you have not logged in ReefPulse before this month.",
    durationDays: 30,
    progressPct: 40,
    completed: false,
    badgeName: "Curious snorkeler",
    points: 80
  },
  {
    id: "kelp-quiet",
    title: "Kelp forest quiet hour",
    icon: "quiet-observe",
    theme: "fun",
    blurb: "One snorkel session where you observe without chasing wildlife — post field notes.",
    durationDays: 7,
    progressPct: 100,
    completed: true,
    badgeName: "Low-impact observer",
    points: 35
  },
  {
    id: "viz-logging",
    title: "Visibility for science",
    icon: "ruler-viz",
    theme: "environmental",
    blurb: "Submit 4 visibility readings at different tides to help the community dataset.",
    durationDays: 21,
    progressPct: 25,
    completed: false,
    badgeName: "Water column scout",
    points: 60
  },
  {
    id: "tidepool-doc",
    title: "Tidepool documentarian",
    icon: "camera-tide",
    theme: "discovery",
    blurb: "Document 3 intertidal species with geotagged photos and respectful distance.",
    durationDays: 10,
    progressPct: 100,
    completed: true,
    badgeName: "Rock pool archivist",
    points: 45
  },
  {
    id: "buddy-snorkel",
    title: "Buddy system weekend",
    icon: "snorkel-buddy",
    theme: "fun",
    blurb: "Complete one snorkel with a partner and both post a safety checklist tick.",
    durationDays: 5,
    progressPct: 0,
    completed: false,
    badgeName: "Pair diver",
    points: 30
  }
];

export const challengeThemes = [
  { id: "all", label: "All" },
  { id: "environmental", label: "Environmental" },
  { id: "discovery", label: "Discover species" },
  { id: "fun", label: "Fun & social" }
];

/** Demo cumulative trophy ladder (points from completed challenges). */
export const trophyTiers = [
  { id: "bronze", name: "Bronze reef", minPoints: 0 },
  { id: "silver", name: "Silver current", minPoints: 100 },
  { id: "gold", name: "Gold kelp", minPoints: 250 },
  { id: "platinum", name: "Platinum tide", minPoints: 500 }
];

/** Icon key for `ChallengeCardIcon` from a challenge id (e.g. community completion). */
export function getChallengeIconId(challengeId) {
  const c = challenges.find((x) => x.id === challengeId);
  return c?.icon ?? "shore-wave";
}

export function demoTrophyPoints() {
  return challenges.filter((c) => c.completed).reduce((sum, c) => sum + c.points, 0);
}

export function currentTrophyTier(points) {
  let tier = trophyTiers[0];
  for (const t of trophyTiers) {
    if (points >= t.minPoints) tier = t;
  }
  return tier;
}

export function nextTrophyTier(points) {
  const idx = trophyTiers.findIndex((t) => points < t.minPoints);
  if (idx === -1) return null;
  return trophyTiers[idx];
}

/** Completed / in-progress counts from the demo challenge list. */
export function demoChallengeCounts() {
  const completed = challenges.filter((c) => c.completed).length;
  const inProgress = challenges.filter((c) => !c.completed && c.progressPct > 0).length;
  const notStarted = challenges.filter((c) => !c.completed && c.progressPct === 0).length;
  return { completed, inProgress, notStarted, total: challenges.length };
}

/**
 * Demo cohort stats vs other snorkelers (replace with API).
 * `yourRank` is 1 = highest points in the modeled leaderboard slice.
 */
export function getDemoTrophyComparison(yourPoints) {
  const cohortSize = 1184;
  const beatPercent = Math.min(94, Math.round(18 + yourPoints * 0.62));
  const yourRank = Math.max(1, Math.min(cohortSize, Math.round(cohortSize * (1 - beatPercent / 100) + 36)));
  return {
    seasonLabel: "Spring 2026",
    cohortSize,
    yourRank,
    beatPercent,
    medianPoints: 88,
    averagePoints: 136
  };
}

/**
 * Neighbors + you for a compact leaderboard (demo).
 * Sorted by points descending; `isYou` marks the signed-in row.
 */
export function getDemoLeaderboardSlice(yourPoints, yourBadges) {
  const peers = [
    { handle: "kelp_kay", points: 520, badges: 11 },
    { handle: "monterey_moss", points: 440, badges: 9 },
    { handle: "tide_doc", points: 380, badges: 8 },
    { handle: "shoreline_sam", points: 220, badges: 5 },
    { handle: "float_fan", points: 195, badges: 4 },
    { handle: "You", points: yourPoints, badges: yourBadges, isYou: true },
    { handle: "reef_novice", points: 72, badges: 2 },
    { handle: "first_fin", points: 40, badges: 1 }
  ];
  return [...peers].sort((a, b) => b.points - a.points);
}

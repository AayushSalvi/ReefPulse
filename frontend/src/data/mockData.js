/**
 * Demo fixtures for ReefPulse UI (beaches, species, sightings, alerts).
 * Kept under frontend/src/data so the Vite app always has a resolvable module.
 */
import { haversineKm } from "../utils/geo";

const LOCATIONS = [
  {
    id: "la-jolla-shores",
    name: "La Jolla Shores",
    region: "San Diego County",
    lat: 32.858,
    lng: -117.256,
    status: "Calm surf, great viz",
    safetyIndex: 91,
    waveFt: 2.1,
    waterTempF: 66,
    rainChancePct: 5,
    windMph: 7,
    algalRisk: "low",
    activeAlerts: [],
    hazardBadges: [],
    speciesPreview: ["Garibaldi", "Leopard shark", "Bat ray"],
    activities: ["snorkeling", "swimming", "surfing"]
  },
  {
    id: "carmel-river-beach",
    name: "Carmel River State Beach",
    region: "Monterey County",
    lat: 36.54,
    lng: -121.908,
    status: "Cool water, mild surge",
    safetyIndex: 88,
    waveFt: 2.8,
    waterTempF: 58,
    rainChancePct: 12,
    windMph: 11,
    algalRisk: "low",
    activeAlerts: ["Small craft advisory offshore"],
    hazardBadges: ["Surge"],
    speciesPreview: ["Sea otter", "Harbor seal", "Kelp bass"],
    activities: ["snorkeling", "swimming", "fishing"]
  },
  {
    id: "crystal-cove",
    name: "Crystal Cove State Beach",
    region: "Orange County",
    lat: 33.577,
    lng: -117.847,
    status: "Popular, moderate waves",
    safetyIndex: 84,
    waveFt: 3.2,
    waterTempF: 64,
    rainChancePct: 8,
    windMph: 9,
    algalRisk: "moderate",
    activeAlerts: [],
    hazardBadges: ["Rip currents"],
    speciesPreview: ["Garibaldi", "Sheephead", "Moray eel"],
    activities: ["snorkeling", "swimming", "surfing"]
  },
  {
    id: "leo-carrillo",
    name: "Leo Carrillo State Park",
    region: "Los Angeles County",
    lat: 34.104,
    lng: -118.933,
    status: "Rocky pools, check tides",
    safetyIndex: 82,
    waveFt: 3.8,
    waterTempF: 62,
    rainChancePct: 15,
    windMph: 13,
    algalRisk: "low",
    activeAlerts: [],
    hazardBadges: ["Rocks", "Surge"],
    speciesPreview: ["Octopus", "Abalone (protected)", "Garibaldi"],
    activities: ["snorkeling", "swimming"]
  },
  {
    id: "refugio-beach",
    name: "Refugio State Beach",
    region: "Santa Barbara County",
    lat: 34.47,
    lng: -120.071,
    status: "Northwest swell possible",
    safetyIndex: 79,
    waveFt: 4.2,
    waterTempF: 61,
    rainChancePct: 18,
    windMph: 14,
    algalRisk: "moderate",
    activeAlerts: ["Elevated surf through Sunday"],
    hazardBadges: ["Surf", "Rocks"],
    speciesPreview: ["Sea lion", "Dolphin", "Leopard shark"],
    activities: ["surfing", "swimming", "fishing"]
  }
];

/** @type {{ id: string; name: string }[]} */
export const snorkelSpecies = [
  { id: "garibaldi", name: "Garibaldi" },
  { id: "leopard-shark", name: "Leopard shark" },
  { id: "bat-ray", name: "Bat ray" },
  { id: "sea-lion", name: "California sea lion" },
  { id: "harbor-seal", name: "Harbor seal" },
  { id: "green-turtle", name: "Green sea turtle" }
];

const SPECIES_BY_ID = {
  garibaldi: {
    id: "garibaldi",
    name: "Garibaldi",
    hint: "California’s iconic bright orange damselfish — common in kelp and rocky reefs.",
    bestSeason: "Year-round; peak spring–summer",
    bestTimeOfDay: "Morning on incoming tide",
    typicalHabitat: "Kelp forest, rocky reef 5–40 ft",
    difficultyNote: "Easy from calm beaches; avoid surge zones if new.",
    detailImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    snorkelSafety: "Low–moderate (watch surge)",
    waterTempF: 64,
    habRisk: "Low",
    exploreLocationId: "la-jolla-shores",
    hotspots: [
      { lat: 32.858, lng: -117.256, label: "La Jolla Shores kelp" },
      { lat: 33.542, lng: -117.785, label: "Crystal Cove reef" },
      { lat: 36.463, lng: -121.958, label: "Monterey kelp edge" }
    ]
  },
  "leopard-shark": {
    id: "leopard-shark",
    name: "Leopard shark",
    hint: "Harmless bottom shark often in warm shallow sand flats in late summer.",
    bestSeason: "July–October",
    bestTimeOfDay: "Midday on calm days",
    typicalHabitat: "Sandy flats, bays",
    difficultyNote: "Stay calm and give space; they are shy.",
    detailImage: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    snorkelSafety: "Low",
    waterTempF: 68,
    habRisk: "Low",
    exploreLocationId: "la-jolla-shores",
    hotspots: [
      { lat: 32.855, lng: -117.262, label: "La Jolla sand flat" },
      { lat: 32.771, lng: -117.252, label: "Mission Bay channel" }
    ]
  },
  "bat-ray": {
    id: "bat-ray",
    name: "Bat ray",
    hint: "Glides over sand; shuffle feet to avoid surprises in shallow water.",
    bestSeason: "Spring–fall",
    bestTimeOfDay: "Morning",
    typicalHabitat: "Sandy bottom near eelgrass",
    difficultyNote: "Shuffle step in entry zones.",
    detailImage: "https://images.unsplash.com/photo-1568430465619-251d0d42ad5e?w=800&q=80",
    snorkelSafety: "Low",
    waterTempF: 65,
    habRisk: "Low",
    exploreLocationId: "crystal-cove",
    hotspots: [
      { lat: 33.54, lng: -117.79, label: "Crystal Cove reef flat" },
      { lat: 32.85, lng: -117.25, label: "Shores sandy zone" }
    ]
  }
};

export const discoveryChips = [
  { id: "garibaldi", label: "Garibaldi hotspots" },
  { id: "leopard-shark", label: "Leopard sharks" },
  { id: "bat-ray", label: "Bat rays" }
];

export function speciesForDiscoveryChip(chipId) {
  const s = SPECIES_BY_ID[chipId];
  return s ? [s] : [];
}

export function matchSpeciesQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const values = Object.values(SPECIES_BY_ID);
  const exact = values.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  return values.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase().split(" ")[0])) || null;
}

const RAW_SIGHTINGS = [
  {
    id: "s1",
    species: "Garibaldi",
    username: "maya_kelp",
    locationId: "la-jolla-shores",
    locationName: "La Jolla Shores",
    time: "2h",
    text: "Clear water on the north reef — mild surge but easy entry. Pair of garibaldi on the outer kelp.",
    author: "Maya K.",
    visibility: "Good",
    tips: ["Park early on weekends", "North reef less crowded before 10"],
    tags: ["fish", "reef", "snorkel"],
    likes: 248,
    commentsCount: 18,
    imageUrl: "https://picsum.photos/seed/reefpulse-s1/1200/800",
    challengeCompletion: {
      challengeId: "species-bingo",
      title: "New fins bingo",
      badgeName: "Progress"
    }
  },
  {
    id: "s2",
    species: "Leopard shark",
    username: "jordan_floats",
    locationId: "la-jolla-shores",
    locationName: "La Jolla Shores",
    time: "8h",
    text: "Sandy channel had three leopards cruising slowly — great viz about 8–10 ft.",
    author: "Jordan",
    visibility: "Excellent",
    tips: [],
    tags: ["fish", "snorkel"],
    likes: 412,
    commentsCount: 31,
    imageUrl: "https://picsum.photos/seed/reefpulse-s2/1200/800"
  },
  {
    id: "s3",
    species: "Harbor seal",
    username: "alex_tidepool",
    locationId: "carmel-river-beach",
    locationName: "Carmel River State Beach",
    time: "1d",
    text: "Seals hauled out on the south rocks — gave them a wide berth. Kelp thin but pretty.",
    author: "Alex R.",
    visibility: "Medium",
    tips: ["Stay 50+ yards from seals"],
    tags: ["mammals", "reef", "snorkel"],
    likes: 189,
    commentsCount: 6,
    imageUrl: "https://picsum.photos/seed/reefpulse-s3/1200/800"
  },
  {
    id: "s4",
    species: "Bat ray",
    username: "sam_sandflat",
    locationId: "crystal-cove",
    locationName: "Crystal Cove State Beach",
    time: "1d",
    text: "Shuffled in and still startled one ray — viz medium after the tide turned.",
    author: "Sam L.",
    visibility: "Medium",
    tips: [],
    tags: ["fish", "snorkel"],
    likes: 96,
    imageUrl: "https://picsum.photos/seed/reefpulse-s4/1200/800"
  },
  {
    id: "s5",
    species: "Sea lion",
    username: "chris_pacific",
    locationId: "refugio-beach",
    locationName: "Refugio State Beach",
    time: "2d",
    text: "Juvenile sea lions very playful — keep hands to yourself, they’re faster than they look.",
    author: "Chris P.",
    visibility: "Good",
    tips: ["Do not chase wildlife"],
    tags: ["mammals", "snorkel"],
    likes: 334,
    imageUrl: "https://picsum.photos/seed/reefpulse-s5/1200/800"
  },
  {
    id: "s6",
    species: "Garibaldi",
    username: "taylor_reef",
    locationId: "leo-carrillo",
    locationName: "Leo Carrillo State Park",
    time: "3d",
    text: "Tide pools were lively; garibaldi deeper on the outer rocks only for strong swimmers.",
    author: "Taylor",
    visibility: "Good",
    tips: ["Check tide charts"],
    tags: ["fish", "reef"],
    likes: 127,
    imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=900&q=80"
  },
  {
    id: "s7",
    species: "Giant kelp forest",
    username: "nico_bluewater",
    locationId: "carmel-river-beach",
    locationName: "Monterey Bay",
    time: "3d",
    text: "Cathedral light in the kelp — viz 15 ft, surge light. Worth the cold water.",
    author: "Nico V.",
    visibility: "Excellent",
    tips: ["7mm wetsuit this week"],
    tags: ["snorkel", "reef"],
    likes: 521,
    commentsCount: 42,
    imageUrl: "https://picsum.photos/seed/reefpulse-s7/1200/800",
    challengeCompletion: {
      challengeId: "kelp-quiet",
      title: "Kelp forest quiet hour",
      badgeName: "Low-impact observer"
    }
  },
  {
    id: "s8",
    species: "Green sea turtle",
    username: "reef_pulse_demo",
    locationId: "crystal-cove",
    locationName: "Crystal Cove State Beach",
    time: "4d",
    text: "Rare calm morning — turtle cruised the outer kelp line. Please keep distance if you spot one.",
    author: "ReefPulse",
    visibility: "Good",
    tips: ["NOAA guidelines apply"],
    tags: ["snorkel", "reef"],
    likes: 892,
    commentsCount: 64,
    imageUrl: "https://picsum.photos/seed/reefpulse-s8/1200/800",
    challengeCompletion: {
      challengeId: "tidepool-doc",
      title: "Tidepool documentarian",
      badgeName: "Rock pool archivist"
    }
  },
  {
    id: "s9",
    species: "Moray eel",
    username: "diverdana",
    locationId: "crystal-cove",
    locationName: "Crystal Cove State Beach",
    time: "5d",
    text: "Peeked out from a crevice — didn’t stick fingers anywhere smart divers don’t.",
    author: "Dana L.",
    visibility: "Good",
    tips: [],
    tags: ["fish", "reef"],
    likes: 203,
    imageUrl: "https://picsum.photos/seed/reefpulse-s9/1200/800"
  }
];

export const communitySightings = RAW_SIGHTINGS;

export function sightingsForLocation(locationId) {
  return RAW_SIGHTINGS.filter((s) => s.locationId === locationId);
}

export function sightingsRecent(n) {
  return RAW_SIGHTINGS.slice(0, n);
}

/**
 * @param {{ tag: string; speciesQuery: string; locationId: string | null; feedSort: string }} opts
 */
export function communitySightingsFiltered(opts) {
  const { tag, speciesQuery, locationId, feedSort } = opts;
  let list = [...RAW_SIGHTINGS];

  if (tag && tag !== "all") {
    list = list.filter((s) => s.tags.includes(tag));
  }
  const sq = (speciesQuery || "").trim().toLowerCase();
  if (sq) {
    list = list.filter((s) => {
      const u = (s.username || "").toLowerCase();
      return (
        s.species.toLowerCase().includes(sq) ||
        s.text.toLowerCase().includes(sq) ||
        u.includes(sq)
      );
    });
  }
  if (locationId) {
    list = list.filter((s) => s.locationId === locationId);
  }

  if (feedSort === "popular") {
    list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  } else if (feedSort === "nearby") {
    const order = LOCATIONS.map((l) => l.id);
    list.sort((a, b) => order.indexOf(a.locationId) - order.indexOf(b.locationId));
  }
  return list;
}

export const locations = LOCATIONS;

export function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id);
}

export function locationsBySafety() {
  return [...LOCATIONS].sort((a, b) => b.safetyIndex - a.safetyIndex);
}

export function filterLocationsByActivities(list, activities) {
  if (!activities?.length) return list;
  return list.filter((loc) => activities.some((a) => (loc.activities || []).includes(a)));
}

export function nearbyLocations(locationId, limit) {
  const origin = findLocation(locationId);
  if (!origin) return [];
  return LOCATIONS.filter((l) => l.id !== locationId)
    .map((l) => ({
      id: l.id,
      name: l.name,
      distanceKm: haversineKm(origin.lat, origin.lng, l.lat, l.lng)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

const SAVED_IDS = ["la-jolla-shores", "crystal-cove", "carmel-river-beach"];

export function savedPlaces() {
  return SAVED_IDS.map((id) => findLocation(id)).filter(Boolean);
}

export const managerFeed = [
  { type: "Advisory", location: "Refugio State Beach", message: "Elevated surf and rip currents through Sunday evening." },
  { type: "HAB", location: "Orange County nearshore", message: "Moderate chlorophyll signal — swimmers advised to avoid discolored water." },
  { type: "Safety", location: "La Jolla Shores", message: "Lifeguards report typical summer crowding; swim near flags." }
];

export function nearestLocation(lat, lng) {
  let best = LOCATIONS[0];
  let bestKm = haversineKm(lat, lng, best.lat, best.lng);
  for (let i = 1; i < LOCATIONS.length; i++) {
    const l = LOCATIONS[i];
    const d = haversineKm(lat, lng, l.lat, l.lng);
    if (d < bestKm) {
      best = l;
      bestKm = d;
    }
  }
  return { location: best, distanceKm: bestKm };
}

export function snorkelRecommendation(location) {
  if (!location) return { tone: "caution", label: "Check conditions" };
  if (location.safetyIndex >= 86 && location.waveFt < 3.5) {
    return { tone: "good", label: "Good snorkeling window" };
  }
  if (location.safetyIndex >= 78) {
    return { tone: "caution", label: "Snorkel with care" };
  }
  return { tone: "bad", label: "Rough conditions — postpone" };
}

export const forecastOutlook = [
  { label: "Monday", short: "Mon", hazard: "Low", bloomPct: 12 },
  { label: "Tuesday", short: "Tue", hazard: "Low", bloomPct: 14 },
  { label: "Wednesday", short: "Wed", hazard: "Moderate", bloomPct: 22 },
  { label: "Thursday", short: "Thu", hazard: "Moderate", bloomPct: 28 },
  { label: "Friday", short: "Fri", hazard: "High surf", bloomPct: 18 },
  { label: "Saturday", short: "Sat", hazard: "High surf", bloomPct: 20 },
  { label: "Sunday", short: "Sun", hazard: "Moderate", bloomPct: 16 },
  { label: "Next Monday", short: "+1", hazard: "Low", bloomPct: 11 }
];

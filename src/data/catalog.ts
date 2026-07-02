import type {
  CompetitionPriority,
  PeriodizationPhase,
  Sport,
  StrengthPhase,
  TestType,
  TrainingQuality,
} from "../types";

/**
 * Sports and their competition events. Marks for races are times in seconds
 * (lower is better); field events are distances/heights in metres.
 */
export const SPORTS: Sport[] = [
  {
    id: "tennis",
    name: "Tennis",
    events: [
      // Tennis results are tracked as the athlete's UTR rating at the event
      // (Universal Tennis Rating, ~1-16.5, higher is better).
      { id: "singles", name: "Singles", unit: "UTR", higherIsBetter: true },
      { id: "doubles", name: "Doubles", unit: "UTR", higherIsBetter: true },
    ],
  },
  {
    id: "athletics",
    name: "Athletics",
    events: [
      { id: "100m", name: "100 m", unit: "s", higherIsBetter: false },
      { id: "200m", name: "200 m", unit: "s", higherIsBetter: false },
      { id: "400m", name: "400 m", unit: "s", higherIsBetter: false },
      { id: "lj", name: "Long Jump", unit: "m", higherIsBetter: true },
      { id: "hj", name: "High Jump", unit: "m", higherIsBetter: true },
      { id: "sp", name: "Shot Put", unit: "m", higherIsBetter: true },
    ],
  },
  {
    id: "swimming",
    name: "Swimming",
    events: [
      { id: "50free", name: "50 m Freestyle", unit: "s", higherIsBetter: false },
      { id: "100free", name: "100 m Freestyle", unit: "s", higherIsBetter: false },
      { id: "100fly", name: "100 m Butterfly", unit: "s", higherIsBetter: false },
    ],
  },
];

export const SPORT_BY_ID: Record<string, Sport> = Object.fromEntries(
  SPORTS.map((s) => [s.id, s]),
);

/**
 * Physical test catalogue. Times (sprints) are lower-is-better; jumps, throws,
 * loads and aerobic scores are higher-is-better.
 */
export const TEST_TYPES: TestType[] = [
  {
    id: "sprint10",
    name: "10 m Acceleration",
    shortName: "10 m",
    unit: "s",
    category: "Speed",
    higherIsBetter: false,
    sports: ["athletics", "swimming", "tennis"],
  },
  {
    id: "sprint30",
    name: "30 m Sprint",
    shortName: "30 m",
    unit: "s",
    category: "Speed",
    higherIsBetter: false,
    sports: ["athletics"],
  },
  {
    id: "flying20",
    name: "Flying 20 m",
    shortName: "Fly 20",
    unit: "s",
    category: "Speed",
    higherIsBetter: false,
    sports: ["athletics"],
  },
  {
    id: "agility505",
    name: "5-0-5 Agility Test",
    shortName: "5-0-5",
    unit: "s",
    category: "Speed",
    higherIsBetter: false,
    sports: ["tennis"],
  },
  {
    id: "serveVel",
    name: "Serve Velocity",
    shortName: "Serve",
    unit: "km/h",
    category: "Power",
    higherIsBetter: true,
    sports: ["tennis"],
  },
  {
    id: "mbThrow",
    name: "Med-Ball Rotational Throw",
    shortName: "MB Throw",
    unit: "m",
    category: "Power",
    higherIsBetter: true,
    sports: ["tennis"],
  },
  {
    id: "grip",
    name: "Grip Strength",
    shortName: "Grip",
    unit: "kg",
    category: "Strength",
    higherIsBetter: true,
    sports: ["tennis"],
  },
  {
    id: "cmj",
    name: "Counter-Movement Jump",
    shortName: "CMJ",
    unit: "cm",
    category: "Power",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "sj",
    name: "Squat Jump",
    shortName: "SJ",
    unit: "cm",
    category: "Power",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "broad",
    name: "Standing Broad Jump",
    shortName: "Broad",
    unit: "cm",
    category: "Power",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "rsi",
    name: "Reactive Strength Index",
    shortName: "RSI",
    unit: "",
    category: "Power",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "squat1rm",
    name: "Back Squat 1RM",
    shortName: "Squat",
    unit: "kg",
    category: "Strength",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "clean1rm",
    name: "Power Clean 1RM",
    shortName: "Clean",
    unit: "kg",
    category: "Strength",
    higherIsBetter: true,
    sports: ["athletics"],
  },
  {
    id: "bench1rm",
    name: "Bench Press 1RM",
    shortName: "Bench",
    unit: "kg",
    category: "Strength",
    higherIsBetter: true,
    sports: ["athletics", "swimming"],
  },
  {
    id: "ift",
    name: "30-15 Intermittent Fitness Test",
    shortName: "30-15 IFT",
    unit: "km/h",
    category: "Endurance",
    higherIsBetter: true,
    sports: [],
  },
  {
    id: "sitreach",
    name: "Sit & Reach",
    shortName: "Sit&Reach",
    unit: "cm",
    category: "Mobility",
    higherIsBetter: true,
    sports: [],
  },
];

export const TEST_BY_ID: Record<string, TestType> = Object.fromEntries(
  TEST_TYPES.map((t) => [t.id, t]),
);

export function testsForSport(sportId: string): TestType[] {
  return TEST_TYPES.filter(
    (t) => t.sports.length === 0 || t.sports.includes(sportId),
  );
}

export const CATEGORY_COLORS: Record<string, string> = {
  Speed: "#0ea5e9",
  Power: "#8b5cf6",
  Strength: "#f97316",
  Endurance: "#22c55e",
  Mobility: "#eab308",
};

export const SPORT_COLORS: Record<string, string> = {
  tennis: "#38bdf8",
  athletics: "#f97316",
  swimming: "#34d399",
};

/** Tests shared by every sport — the fair basis for cross-sport comparison. */
export function commonTests(): TestType[] {
  return TEST_TYPES.filter((t) =>
    SPORTS.every((s) => t.sports.length === 0 || t.sports.includes(s.id)),
  );
}

// ── Periodization catalogue: phases, strength phases, training qualities ──────
// Shared by the Periodization plan builder and the Athlete Profile
// schedule/calendar tabs. Do not re-declare these color/order maps on another
// page — extend them here so every consumer stays in sync.

export const PHASE_ORDER: PeriodizationPhase[] = [
  "Preparation",
  "Pre-Competition",
  "Competition",
  "Transition",
];

export const PHASE_COLOR: Record<PeriodizationPhase, string> = {
  Preparation: "#0ea5e9",
  "Pre-Competition": "#8b5cf6",
  Competition: "#f97316",
  Transition: "#22c55e",
};

export const STRENGTH_PHASE_ORDER: StrengthPhase[] = [
  "Accumulation",
  "Intensification",
  "Realization",
  "Deload",
  "Transition",
];

export const STRENGTH_PHASE_COLOR: Record<StrengthPhase, string> = {
  Accumulation: "#38bdf8",
  Intensification: "#a78bfa",
  Realization: "#fb923c",
  Deload: "#4ade80",
  Transition: "#94a3b8",
};

export const QUALITY_GROUPS: { label: string; qualities: TrainingQuality[] }[] = [
  {
    label: "Strength",
    qualities: [
      "Anatomical Adaptation",
      "Max Strength",
      "Strength Endurance",
      "Hypertrophy",
      "Core Stability",
      "Reactive Strength",
    ],
  },
  {
    label: "Speed & Power",
    qualities: ["Power", "Speed", "Speed Endurance", "Agility"],
  },
  {
    label: "Conditioning",
    qualities: [
      "Aerobic Base",
      "Aerobic Capacity",
      "Anaerobic Capacity",
      "General Conditioning",
    ],
  },
  {
    label: "Support",
    qualities: ["Mobility", "Technique", "Recovery", "Competition"],
  },
];

export const ALL_QUALITIES: TrainingQuality[] = QUALITY_GROUPS.flatMap((g) => g.qualities);

export const QUALITY_COLOR: Record<TrainingQuality, string> = {
  "Anatomical Adaptation": "#d97706",
  "Max Strength": "#ef4444",
  "Strength Endurance": "#f97316",
  "Hypertrophy": "#f43f5e",
  "Core Stability": "#f472b6",
  "Reactive Strength": "#a3e635",
  "Power": "#eab308",
  "Speed": "#facc15",
  "Speed Endurance": "#fb923c",
  "Agility": "#34d399",
  "Aerobic Base": "#38bdf8",
  "Aerobic Capacity": "#60a5fa",
  "Anaerobic Capacity": "#a78bfa",
  "General Conditioning": "#94a3b8",
  "Mobility": "#2dd4bf",
  "Technique": "#c084fc",
  "Recovery": "#4ade80",
  "Competition": "#fbbf24",
};

/** Standard competition priority order: A = key/taper target, B = important, C = training comp. */
export const PRIORITY_ORDER: CompetitionPriority[] = ["A", "B", "C"];

export const PRIORITY_COLOR: Record<CompetitionPriority, string> = {
  A: "#f43f5e",
  B: "#fbbf24",
  C: "#94a3b8",
};

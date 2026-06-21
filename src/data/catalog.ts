import type { Sport, TestType } from "../types";

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

import type {
  Athlete,
  AthleteProfile,
  CompetitionResult,
  Dataset,
  Gender,
  PeriodizationPhase,
  TestResult,
  TrainingWeek,
} from "../types";
import { SPORTS } from "./catalog";

/** Small deterministic PRNG (mulberry32) so the dataset is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_M = ["Liam", "Noah", "Mateo", "Diego", "Andre", "Kai", "Yusuf", "Tomas", "Ravi", "Eli", "Marcus", "Otto"];
const FIRST_F = ["Sofia", "Mia", "Amara", "Lena", "Nora", "Priya", "Chloe", "Zara", "Ines", "Aria", "Maya", "Tess"];
const LAST = ["Reyes", "Novak", "Okafor", "Haddad", "Lindqvist", "Moreno", "Tan", "Costa", "Bauer", "Sharma", "Diallo", "Vega", "Kovac", "Ferraro"];

/** Reference value for a test for an adult elite-club athlete of the given gender. */
const REF: Record<string, { m: number; f: number; better: "high" | "low" }> = {
  sprint10: { m: 1.74, f: 1.9, better: "low" },
  sprint30: { m: 4.05, f: 4.5, better: "low" },
  flying20: { m: 2.12, f: 2.36, better: "low" },
  cmj: { m: 44, f: 35, better: "high" },
  sj: { m: 40, f: 32, better: "high" },
  broad: { m: 278, f: 228, better: "high" },
  rsi: { m: 2.5, f: 2.05, better: "high" },
  ift: { m: 19.5, f: 18, better: "high" },
  sitreach: { m: 12, f: 18, better: "high" },
};

/** Performance multiplier by age: athletes mature toward a peak around 23. */
function ageFactor(age: number): number {
  if (age >= 23) return 1;
  if (age <= 12) return 0.68;
  return 0.68 + (0.32 * (age - 12)) / 11;
}

const MONTHS = 24;
const today = new Date("2026-06-21");

function isoMonthsAgo(monthsAgo: number, dayJitter = 0): string {
  const d = new Date(today);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(Math.min(28, 1 + dayJitter));
  return d.toISOString().slice(0, 10);
}

function phaseForMonth(monthsAgo: number): PeriodizationPhase {
  // Seasonal cycle: indoor + outdoor seasons across the 24-month window.
  const m = ((MONTHS - monthsAgo) % 12 + 12) % 12;
  if (m <= 2) return "Preparation";
  if (m <= 4) return "Pre-Competition";
  if (m <= 8) return "Competition";
  if (m <= 9) return "Transition";
  return "Preparation";
}

export function generateDataset(seed = 20260621): Dataset {
  const rand = rng(seed);
  const randn = () => {
    // Box-Muller for approximately normal noise.
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const athletes: Athlete[] = [];
  const testResults: TestResult[] = [];
  const competitionResults: CompetitionResult[] = [];
  const trainingWeeks: TrainingWeek[] = [];

  const N = 28;
  for (let i = 0; i < N; i++) {
    const gender: Gender = rand() < 0.5 ? "M" : "F";
    const first = (gender === "M" ? FIRST_M : FIRST_F)[Math.floor(rand() * 12)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const age = 14 + Math.floor(rand() * 14); // 14-27
    const birth = new Date(today);
    birth.setFullYear(birth.getFullYear() - age);
    birth.setMonth(Math.floor(rand() * 12));

    const heightCm = Math.round((gender === "M" ? 178 : 167) + randn() * 7);
    const massKg = Math.round((gender === "M" ? 73 : 60) + randn() * 7 + (heightCm - (gender === "M" ? 178 : 167)) * 0.4);

    // Latent talent shared across tests so abilities correlate with each other.
    const talent = Math.max(-1.6, Math.min(1.6, randn()));
    const experienceYears = Math.min(age - 11, Math.round(2 + rand() * 8));
    const adherence = 0.7 + rand() * 0.28; // training compliance

    const athleteId = `ath-${i + 1}`;

    // Assign one or two sport profiles.
    const profiles: AthleteProfile[] = [];
    const primarySport = rand() < 0.78 ? SPORTS[0] : SPORTS[1];
    const evPool = primarySport.events;
    const evCount = 1 + (rand() < 0.5 ? 1 : 0);
    const eventIds: string[] = [];
    for (let e = 0; e < evCount; e++) {
      const ev = evPool[Math.floor(rand() * evPool.length)].id;
      if (!eventIds.includes(ev)) eventIds.push(ev);
    }
    profiles.push({
      id: `prof-${i + 1}-1`,
      athleteId,
      sportId: primarySport.id,
      eventIds,
      startedOn: isoMonthsAgo(experienceYears * 12, Math.floor(rand() * 27)),
    });

    athletes.push({
      id: athleteId,
      name: `${first} ${last}`,
      gender,
      birthDate: birth.toISOString().slice(0, 10),
      heightCm,
      massKg,
      profiles,
    });

    const sportId = primarySport.id;
    const ageF = ageFactor(age);

    // ---- Test sessions roughly every two months ----
    const sessionMonths: number[] = [];
    for (let mAgo = MONTHS; mAgo >= 0; mAgo -= 2) sessionMonths.push(mAgo);

    const testsToRun = ["sprint30", "sprint10", "flying20", "cmj", "sj", "broad", "rsi", "ift", "sitreach"];

    for (const mAgo of sessionMonths) {
      // Progress fraction across the window, scaled by adherence and (inverse) age.
      const elapsed = (MONTHS - mAgo) / MONTHS;
      const trainability = age < 20 ? 1.1 : 0.8;
      const progress = elapsed * adherence * trainability; // 0..~1.2

      for (const tid of testsToRun) {
        const ref = REF[tid];
        if (!ref) continue;
        const base = gender === "M" ? ref.m : ref.f;
        const noise = randn() * 0.025;
        // Talent + age maturation + accumulated progress shift the value.
        // Combined "quality" 0..~1.5, higher = better performance.
        const quality = ageF * (1 + 0.12 * talent + 0.1 * progress);
        let value: number;
        if (ref.better === "high") {
          value = base * quality * (1 + noise);
        } else {
          // Lower is better: divide so quality improvements reduce the time.
          value = (base / quality) * (1 + noise);
        }
        if (tid === "sitreach") value = base + talent * 4 + progress * 3 + randn() * 1.5;

        testResults.push({
          id: `tr-${athleteId}-${tid}-${mAgo}`,
          athleteId,
          sportId,
          testTypeId: tid,
          date: isoMonthsAgo(mAgo, Math.floor(rand() * 20)),
          value: Math.round(value * 100) / 100,
        });
      }

      // Strength tests scale with body mass and quality.
      const strengthQuality = ageF * (1 + 0.18 * talent + 0.14 * progress);
      const squat = massKg * (gender === "M" ? 1.85 : 1.45) * strengthQuality * (1 + randn() * 0.03);
      const clean = squat * (0.68 + randn() * 0.02);
      const bench = massKg * (gender === "M" ? 1.2 : 0.78) * strengthQuality * (1 + randn() * 0.03);
      for (const [tid, val] of [
        ["squat1rm", squat],
        ["clean1rm", clean],
        ["bench1rm", bench],
      ] as const) {
        testResults.push({
          id: `tr-${athleteId}-${tid}-${mAgo}`,
          athleteId,
          sportId,
          testTypeId: tid,
          date: isoMonthsAgo(mAgo, Math.floor(rand() * 20)),
          value: Math.round(val * 2) / 2,
        });
      }
    }

    // ---- Competition results during competition phases ----
    const comps = ["Indoor Open", "Regional Champs", "League Round", "National Trials", "Grand Prix", "Club Meet"];
    for (let mAgo = MONTHS; mAgo >= 0; mAgo--) {
      if (phaseForMonth(mAgo) !== "Competition") continue;
      if (rand() > 0.55) continue;
      const evId = eventIds[Math.floor(rand() * eventIds.length)];
      const ev = evPool.find((e) => e.id === evId)!;
      const elapsed = (MONTHS - mAgo) / MONTHS;
      const progress = elapsed * adherence;
      const quality = ageF * (1 + 0.13 * talent + 0.1 * progress);
      // Event reference marks (decent club performances).
      const evRef: Record<string, { m: number; f: number }> = {
        "100m": { m: 11.0, f: 12.2 },
        "200m": { m: 22.3, f: 24.8 },
        "400m": { m: 49.5, f: 56.0 },
        lj: { m: 7.0, f: 5.8 },
        hj: { m: 2.0, f: 1.7 },
        sp: { m: 14.5, f: 12.0 },
        "50free": { m: 24.0, f: 27.0 },
        "100free": { m: 52.0, f: 58.0 },
        "100fly": { m: 56.0, f: 63.0 },
      };
      const r = evRef[evId] ?? { m: 12, f: 13 };
      const base = gender === "M" ? r.m : r.f;
      let mark: number;
      if (ev.higherIsBetter) mark = base * quality * (1 + randn() * 0.02);
      else mark = (base / quality) * (1 + randn() * 0.015);

      competitionResults.push({
        id: `cr-${athleteId}-${mAgo}`,
        athleteId,
        sportId,
        eventId: evId,
        date: isoMonthsAgo(mAgo, Math.floor(rand() * 25)),
        mark: Math.round(mark * 100) / 100,
        competition: comps[Math.floor(rand() * comps.length)],
        placing: 1 + Math.floor(rand() * 8),
      });
    }

    // ---- Weekly training load with periodization ----
    for (let w = MONTHS * 4; w >= 0; w--) {
      const monthsAgo = w / 4;
      const phase = phaseForMonth(Math.round(monthsAgo));
      const basePlanned =
        phase === "Preparation" ? 620 :
        phase === "Pre-Competition" ? 540 :
        phase === "Competition" ? 430 : 230;
      const planned = Math.round(basePlanned * (0.9 + rand() * 0.2));
      const actual = Math.round(planned * (adherence * (0.92 + rand() * 0.16)));
      const ws = new Date(today);
      ws.setDate(ws.getDate() - w * 7);
      trainingWeeks.push({
        id: `tw-${athleteId}-${w}`,
        athleteId,
        sportId,
        weekStart: ws.toISOString().slice(0, 10),
        phase,
        plannedLoad: planned,
        actualLoad: actual,
      });
    }
  }

  return { athletes, testResults, competitionResults, trainingWeeks };
}

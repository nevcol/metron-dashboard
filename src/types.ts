export type Gender = "M" | "F";

export type TestCategory =
  | "Speed"
  | "Power"
  | "Strength"
  | "Endurance"
  | "Mobility";

/** A measurable physical test, e.g. a 30 m sprint or a counter-movement jump. */
export interface TestType {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  category: TestCategory;
  /** True when a larger raw value is a better result (jump height); false for times. */
  higherIsBetter: boolean;
  /** Sports this test applies to. Empty = applies to all. */
  sports: string[];
}

export interface Sport {
  id: string;
  name: string;
  /** Competition events within the sport, e.g. "100m", "Long Jump". */
  events: SportEvent[];
}

export interface SportEvent {
  id: string;
  name: string;
  /** Unit of the competition result, e.g. "s" or "m". */
  unit: string;
  /** True when a larger competition mark is better (distance); false for races. */
  higherIsBetter: boolean;
}

/** An athlete's enrolment in a single sport. One person may have several. */
export interface AthleteProfile {
  id: string;
  athleteId: string;
  sportId: string;
  /** Primary events the athlete competes in (event ids). */
  eventIds: string[];
  /** Date the athlete began structured training in this sport. */
  startedOn: string;
}

export interface Athlete {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string;
  heightCm: number;
  massKg: number;
  /** Sport profiles. Each is a per-sport view of the athlete. */
  profiles: AthleteProfile[];
}

/** A single recorded test measurement. */
export interface TestResult {
  id: string;
  athleteId: string;
  sportId: string;
  testTypeId: string;
  date: string;
  value: number;
}

/** A competition result. */
export interface CompetitionResult {
  id: string;
  athleteId: string;
  sportId: string;
  eventId: string;
  date: string;
  /** Mark achieved (time in s, distance in m, etc.). */
  mark: number;
  competition: string;
  placing: number;
}

/** Standard competition priority: A = key/taper target, B = important, C = training comp. */
export type CompetitionPriority = "A" | "B" | "C";

/** A scheduled (future) competition placed on an athlete's training plan. */
export interface PlannedCompetition {
  id: string;
  athleteId: string;
  sportId: string;
  date: string;
  name: string;
  priority: CompetitionPriority;
}

export type PeriodizationPhase =
  | "Preparation"
  | "Pre-Competition"
  | "Competition"
  | "Transition";

export type StrengthPhase =
  | "Accumulation"
  | "Intensification"
  | "Realization"
  | "Deload"
  | "Transition";

export type TrainingQuality =
  | "Anatomical Adaptation"
  | "Max Strength"
  | "Strength Endurance"
  | "Hypertrophy"
  | "Core Stability"
  | "Reactive Strength"
  | "Power"
  | "Speed"
  | "Speed Endurance"
  | "Agility"
  | "Aerobic Base"
  | "Aerobic Capacity"
  | "Anaerobic Capacity"
  | "General Conditioning"
  | "Mobility"
  | "Technique"
  | "Recovery"
  | "Competition";

/** A weekly block of an athlete's periodized training plan. */
export interface TrainingWeek {
  id: string;
  athleteId: string;
  sportId: string;
  weekStart: string;
  phase: PeriodizationPhase;
  strengthPhase?: StrengthPhase;
  primaryQuality?: TrainingQuality;
  secondaryQualities?: TrainingQuality[];
  /** Planned training load in arbitrary units (e.g. session-RPE * minutes / 100). */
  plannedLoad: number;
  /** Actual completed load. */
  actualLoad: number;
}

export interface Dataset {
  athletes: Athlete[];
  testResults: TestResult[];
  competitionResults: CompetitionResult[];
  trainingWeeks: TrainingWeek[];
  /** Scheduled competitions attached to training plans (may be absent in older stored data). */
  plannedCompetitions?: PlannedCompetition[];
}

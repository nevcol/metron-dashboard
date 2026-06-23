import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Athlete,
  AthleteProfile,
  CompetitionResult,
  Dataset,
  PeriodizationPhase,
  StrengthPhase,
  TestResult,
  TrainingQuality,
  TrainingWeek,
} from "../types";
import { generateDataset } from "./generate";

const STORAGE_KEY = "metron.dataset.v1";

interface StoreValue extends Dataset {
  addAthlete: (a: Omit<Athlete, "id" | "profiles"> & { profile: Omit<AthleteProfile, "id" | "athleteId"> }) => void;
  addTestResult: (r: Omit<TestResult, "id">) => void;
  addCompetitionResult: (r: Omit<CompetitionResult, "id">) => void;
  /**
   * Replace an athlete's training plan for one sport with a fresh set of weeks.
   * Existing logged `actualLoad` is preserved for any week whose `weekStart`
   * matches, so building/editing a plan never wipes completed-training history.
   */
  saveTrainingPlan: (
    athleteId: string,
    sportId: string,
    weeks: {
      weekStart: string;
      phase: PeriodizationPhase;
      plannedLoad: number;
      strengthPhase?: StrengthPhase;
      primaryQuality?: TrainingQuality;
      secondaryQualities?: TrainingQuality[];
    }[],
  ) => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): Dataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Dataset;
  } catch {
    /* ignore corrupt storage */
  }
  return generateDataset();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      /* storage may be unavailable */
    }
  }, [dataset]);

  const value = useMemo<StoreValue>(
    () => ({
      ...dataset,
      addAthlete: ({ profile, ...rest }) =>
        setDataset((d) => {
          const id = `ath-manual-${Date.now()}`;
          const athlete: Athlete = {
            ...rest,
            id,
            profiles: [{ ...profile, id: `prof-${id}-1`, athleteId: id }],
          };
          return { ...d, athletes: [...d.athletes, athlete] };
        }),
      addTestResult: (r) =>
        setDataset((d) => ({
          ...d,
          testResults: [
            ...d.testResults,
            { ...r, id: `tr-manual-${Date.now()}` },
          ],
        })),
      addCompetitionResult: (r) =>
        setDataset((d) => ({
          ...d,
          competitionResults: [
            ...d.competitionResults,
            { ...r, id: `cr-manual-${Date.now()}` },
          ],
        })),
      saveTrainingPlan: (athleteId, sportId, weeks) =>
        setDataset((d) => {
          // Upsert by weekStart: update the weeks the plan covers (keeping any
          // logged actualLoad), append weeks that are new, and leave every other
          // week of history untouched.
          const byKey = new Map(weeks.map((w) => [w.weekStart, w]));
          const updated = d.trainingWeeks.map((w) => {
            if (w.athleteId === athleteId && w.sportId === sportId && byKey.has(w.weekStart)) {
              const next = byKey.get(w.weekStart)!;
              byKey.delete(w.weekStart);
              return {
                ...w,
                phase: next.phase,
                plannedLoad: Math.round(next.plannedLoad),
                strengthPhase: next.strengthPhase,
                primaryQuality: next.primaryQuality,
                secondaryQualities: next.secondaryQualities,
              };
            }
            return w;
          });
          const stamp = Date.now();
          let i = 0;
          const added: TrainingWeek[] = [...byKey.values()].map((w) => ({
            id: `tw-plan-${athleteId}-${sportId}-${i++}-${stamp}`,
            athleteId,
            sportId,
            weekStart: w.weekStart,
            phase: w.phase,
            plannedLoad: Math.round(w.plannedLoad),
            actualLoad: 0,
            strengthPhase: w.strengthPhase,
            primaryQuality: w.primaryQuality,
            secondaryQualities: w.secondaryQualities,
          }));
          return { ...d, trainingWeeks: [...updated, ...added] };
        }),
      resetData: () => {
        localStorage.removeItem(STORAGE_KEY);
        setDataset(generateDataset());
      },
    }),
    [dataset],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useAthlete(id: string | undefined): Athlete | undefined {
  const { athletes } = useStore();
  return athletes.find((a) => a.id === id);
}

/** Latest test value per testType for an athlete in a sport. */
export function latestTests(
  results: TestResult[],
  athleteId: string,
  sportId: string,
): Map<string, TestResult> {
  const map = new Map<string, TestResult>();
  for (const r of results) {
    if (r.athleteId !== athleteId || r.sportId !== sportId) continue;
    const cur = map.get(r.testTypeId);
    if (!cur || r.date > cur.date) map.set(r.testTypeId, r);
  }
  return map;
}

export function athleteTrainingWeeks(
  weeks: TrainingWeek[],
  athleteId: string,
  sportId: string,
): TrainingWeek[] {
  return weeks
    .filter((w) => w.athleteId === athleteId && w.sportId === sportId)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

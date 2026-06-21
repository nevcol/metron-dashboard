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
  CompetitionResult,
  Dataset,
  TestResult,
  TrainingWeek,
} from "../types";
import { generateDataset } from "./generate";

const STORAGE_KEY = "metron.dataset.v1";

interface StoreValue extends Dataset {
  addTestResult: (r: Omit<TestResult, "id">) => void;
  addCompetitionResult: (r: Omit<CompetitionResult, "id">) => void;
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

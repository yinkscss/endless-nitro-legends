// Choices the game keeps on this phone: which car is picked and the best score. Nothing personal.

const CAR_KEY = "neon-drift:car";
const BEST_KEY = "neon-drift";
const NAME_KEY = "neon-drift:name";

export function selectedCar(): number {
  try {
    return Number(window.localStorage.getItem(CAR_KEY)) || 1;
  } catch {
    return 1;
  }
}

export function setSelectedCar(id: number) {
  try {
    window.localStorage.setItem(CAR_KEY, String(id));
  } catch {
    /* the pick just isn't remembered */
  }
}

/** The name this player last put on the board, so free play only asks once. */
export function racerName(): string {
  try {
    return (window.localStorage.getItem(NAME_KEY) ?? "").slice(0, 20);
  } catch {
    return "";
  }
}

export function saveRacerName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name.slice(0, 20));
  } catch {
    /* the name just isn't remembered */
  }
}

export function bestScore(): number {
  try {
    return Number(window.localStorage.getItem("best:" + BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Save the run if it beats the best score on this phone. Returns true when it does. */
export function saveBestScore(score: number): boolean {
  if (score <= bestScore()) return false;
  try {
    window.localStorage.setItem("best:" + BEST_KEY, String(score));
  } catch {
    /* storage is blocked */
  }
  return true;
}

/** A row on the shared board. Everyone reads everybody's best runs. */
export type ScoreRecord = {
  racer: string;
  score: number;
  car: number;
  level: number;
};

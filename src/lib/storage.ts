// Mock persistence layer. Swap with API calls to your VPS/Mongo backend later.
export type GameKey = "reflex" | "memory" | "balance";

export interface GameScores {
  reflex: number | null;
  memory: number | null;
  balance: number | null;
}

export interface UserRecord {
  contact: string;             // mobile or email
  name?: string;
  address?: string;
  scores: GameScores;
  total: number;
  category: string;
  consent: boolean;
  createdAt: string;
}

const SCORES_KEY = "revital.currentScores";
const USER_KEY = "revital.user";
const ALL_USERS_KEY = "revital.allUsers";
const CONSENT_KEY = "revital.cookieConsent";

export const getCurrentScores = (): GameScores => {
  if (typeof window === "undefined") return { reflex: null, memory: null, balance: null };
  try { return JSON.parse(localStorage.getItem(SCORES_KEY) || "") as GameScores; }
  catch { return { reflex: null, memory: null, balance: null }; }
};

export const saveGameScore = (game: GameKey, score: number) => {
  const cur = getCurrentScores();
  cur[game] = score;
  localStorage.setItem(SCORES_KEY, JSON.stringify(cur));
};

export const resetScores = () => localStorage.removeItem(SCORES_KEY);

export const computeTotal = (s: GameScores) =>
  (s.reflex ?? 0) + (s.memory ?? 0) + (s.balance ?? 0);

export const categorize = (total: number) => {
  if (total >= 240) return { label: "Peak Performer", tier: "S" };
  if (total >= 180) return { label: "High Energy", tier: "A" };
  if (total >= 120) return { label: "Charged Up", tier: "B" };
  if (total >= 60) return { label: "Warming Up", tier: "C" };
  return { label: "Recharge Needed", tier: "D" };
};

export const saveUser = (u: UserRecord) => {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
  const all = getAllUsers();
  const idx = all.findIndex((x) => x.contact === u.contact);
  if (idx >= 0) all[idx] = u; else all.push(u);
  localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all));
};

export const getUser = (): UserRecord | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || ""); } catch { return null; }
};

export const getAllUsers = (): UserRecord[] => {
  try { return JSON.parse(localStorage.getItem(ALL_USERS_KEY) || "[]"); } catch { return []; }
};

export const findUserByContact = (contact: string) =>
  getAllUsers().find((u) => u.contact.toLowerCase() === contact.toLowerCase()) || null;

export const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";
export const setConsent = (v: boolean) => localStorage.setItem(CONSENT_KEY, v ? "true" : "false");

// Mock OTP — accept "123456"
export const MOCK_OTP = "123456";

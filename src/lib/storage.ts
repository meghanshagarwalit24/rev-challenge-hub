// Mock persistence layer. Swap with API calls to your VPS/Mongo backend later.
export type GameKey = "reflex" | "memory" | "balance";

export interface GameScores {
  reflex: number | null;
  memory: number | null;
  balance: number | null;
}

export interface UserRecord {
  userId: string;              // generated unique id
  contact: string;             // mobile or email
  name?: string;
  address?: string;
  scores: GameScores;
  total: number;
  category: string;
  consent: boolean;
  createdAt: string;
}

export const generateUserId = (): string => {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `RVT-${ts}${rand}`;
};

export const logout = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCORES_KEY);
};

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
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) || "") as UserRecord;
    if (!u) return null;
    // Backfill userId for older records
    if (!u.userId) {
      u.userId = generateUserId();
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      const all = getAllUsers();
      const idx = all.findIndex((x) => x.contact === u.contact);
      if (idx >= 0) { all[idx] = u; localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all)); }
    }
    return u;
  } catch { return null; }
};

export const getAllUsers = (): UserRecord[] => {
  try { return JSON.parse(localStorage.getItem(ALL_USERS_KEY) || "[]"); } catch { return []; }
};

export const findUserByContact = (contact: string) =>
  getAllUsers().find((u) => u.contact.toLowerCase() === contact.toLowerCase()) || null;

export const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";
export const setConsent = (v: boolean) => localStorage.setItem(CONSENT_KEY, v ? "true" : "false");

export const isLoggedIn = () => !!getUser();

// Mock OTP — accept "123456"
export const MOCK_OTP = "123456";

// Sequential challenge progression: reflex → memory → balance
export const CHALLENGE_ORDER: GameKey[] = ["reflex", "memory", "balance"];

export const isGameUnlocked = (game: GameKey): boolean => {
  const s = getCurrentScores();
  const idx = CHALLENGE_ORDER.indexOf(game);
  if (idx <= 0) return true;
  // unlocked only if every prior challenge has a score
  return CHALLENGE_ORDER.slice(0, idx).every((k) => s[k] !== null);
};

export const getNextGame = (): GameKey | null => {
  const s = getCurrentScores();
  return CHALLENGE_ORDER.find((k) => s[k] === null) ?? null;
};

export const getCompletedCount = (): number => {
  const s = getCurrentScores();
  return CHALLENGE_ORDER.filter((k) => s[k] !== null).length;
};

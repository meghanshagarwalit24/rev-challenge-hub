// Persistence layer — session state lives in localStorage; user records are stored in MongoDB via server functions.
export type GameKey = "reflex" | "memory" | "balance";

export interface GameScores {
  reflex: number | null;
  memory: number | null;
  balance: number | null;
}

export interface UserRecord {
  userId: string; // generated unique id
  contact: string; // mobile or email
  username?: string; // unique username for referrals
  name?: string;
  address?: string;
  scores: GameScores;
  total: number;
  category: string;
  consent: boolean;
  createdAt: string;
  playDates?: string[]; // YYYY-MM-DD dates the user played (for streak tracking)
  referredBy?: string; // contact of the user who referred this person
  referCount?: number; // number of people this user has referred
}

export const generateUserId = (): string => {
  const randomPart = (() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  })();
  const rand = randomPart.slice(0, 6).toUpperCase();
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
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) || "") as GameScores;
  } catch {
    return { reflex: null, memory: null, balance: null };
  }
};

export const saveGameScore = (game: GameKey, score: number) => {
  const cur = getCurrentScores();
  cur[game] = score;
  localStorage.setItem(SCORES_KEY, JSON.stringify(cur));
};

/** Returns today's date as YYYY-MM-DD. */
export const todayDateString = (): string => new Date().toISOString().slice(0, 10);

const MS_PER_DAY = 86_400_000; // milliseconds in one day

/** Calculate current consecutive-day streak from a sorted array of YYYY-MM-DD strings. */
export const calcStreak = (playDates: string[]): number => {
  if (!playDates || playDates.length === 0) return 0;
  const sorted = [...new Set(playDates)].sort().reverse(); // most recent first
  const today = todayDateString();
  const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);
  // streak must include today or yesterday to be "active"
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / MS_PER_DAY;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
};

export const resetScores = () => localStorage.removeItem(SCORES_KEY);

export const computeTotal = (s: GameScores) => (s.reflex ?? 0) + (s.memory ?? 0) + (s.balance ?? 0);

export const categorize = (total: number) => {
  if (total >= 240) return { label: "Peak Performer", tier: "S" };
  if (total >= 180) return { label: "High Energy", tier: "A" };
  if (total >= 120) return { label: "Charged Up", tier: "B" };
  if (total >= 60) return { label: "Warming Up", tier: "C" };
  return { label: "Recharge Needed", tier: "D" };
};

export const saveUser = (u: UserRecord) => {
  const all = getAllUsers();
  const idx = all.findIndex((x) => x.contact === u.contact);
  const existing = idx >= 0 ? all[idx] : null;
  const normalizedReferral = normalizeUsername(u.referredBy || "");
  const firstTimeReferral = !!normalizedReferral && !existing?.referredBy;

  if (idx >= 0) all[idx] = u;
  else all.push(u);

  if (firstTimeReferral) {
    const referredIdx = all.findIndex(
      (candidate) =>
        candidate.contact.toLowerCase() === normalizedReferral ||
        normalizeUsername(candidate.username || "") === normalizedReferral,
    );
    const selfContact = u.contact.toLowerCase();
    if (referredIdx >= 0 && all[referredIdx].contact.toLowerCase() !== selfContact) {
      all[referredIdx] = {
        ...all[referredIdx],
        referCount: (all[referredIdx].referCount ?? 0) + 1,
      };
    }
  }

  localStorage.setItem(USER_KEY, JSON.stringify(u));
  localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all));
};

/** Persist user to MongoDB (server) AND update localStorage cache. */
export const saveUserRemote = async (u: UserRecord): Promise<void> => {
  // Merge today's date into playDates
  const today = todayDateString();
  const existing = u.playDates ?? [];
  const merged = existing.includes(today) ? existing : [...existing, today];
  const withDate: UserRecord = { ...u, playDates: merged };

  // Keep a local copy when possible so OTP verification is not blocked by transient server/db issues.
  try {
    saveUser(withDate);
  } catch (e) {
    console.warn("Local save failed; continuing with remote save attempt", e);
  }

  try {
    const { saveUserFn } = await import("@/server/userFns");
    await saveUserFn({ data: withDate });
  } catch (e) {
    console.warn("Remote save failed; user was saved locally", e);
  }
};

/** Look up a user by contact in MongoDB (server), with localStorage as fallback. */
export const findUserByContactRemote = async (contact: string): Promise<UserRecord | null> => {
  try {
    const { getUserByContactFn } = await import("@/server/userFns");
    const remote = await getUserByContactFn({ data: { contact } });
    if (remote) {
      // sync to local cache
      saveUser(remote);
      return remote;
    }
  } catch (e) {
    console.warn("MongoDB lookup failed, falling back to localStorage", e);
  }
  return findUserByContact(contact);
};

/** Fetch all users from MongoDB (server), with localStorage as fallback. */
export const getAllUsersRemote = async (): Promise<UserRecord[]> => {
  try {
    const { getAllUsersFn } = await import("@/server/userFns");
    return await getAllUsersFn();
  } catch (e) {
    console.warn("MongoDB getAllUsers failed, falling back to localStorage", e);
    return getAllUsers();
  }
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
      if (idx >= 0) {
        all[idx] = u;
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all));
      }
    }
    return u;
  } catch {
    return null;
  }
};

export const getAllUsers = (): UserRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(ALL_USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const findUserByContact = (contact: string) =>
  getAllUsers().find((u) => u.contact.toLowerCase() === contact.toLowerCase()) || null;

export const normalizeUsername = (value: string): string =>
  value.trim().toLowerCase().replace(/^@+/, "");

export const findUserByUsername = (username: string) =>
  getAllUsers().find((u) => normalizeUsername(u.username || "") === normalizeUsername(username)) ||
  null;

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

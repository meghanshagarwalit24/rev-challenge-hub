// Mock leaderboard data — swap with API later
import { getAllUsers, type UserRecord } from "./storage";

export interface LeaderEntry {
  name: string;
  contact: string;
  total: number;
  category: string;
  when: string;
}

const SAMPLE_DAILY: LeaderEntry[] = [
  { name: "Aarav S.",    contact: "+971•••2341", total: 278, category: "Peak Performer", when: "2h ago" },
  { name: "Layla M.",    contact: "+971•••8812", total: 264, category: "Peak Performer", when: "3h ago" },
  { name: "Omar K.",     contact: "+971•••4509", total: 251, category: "Peak Performer", when: "4h ago" },
  { name: "Priya R.",    contact: "+971•••7720", total: 233, category: "High Energy",    when: "5h ago" },
  { name: "Hassan A.",   contact: "+971•••1198", total: 219, category: "High Energy",    when: "6h ago" },
];

const SAMPLE_GLOBAL: LeaderEntry[] = [
  { name: "Zayd Al-Farsi", contact: "Dubai",     total: 297, category: "Peak Performer", when: "Champion" },
  { name: "Noor Ibrahim",  contact: "Abu Dhabi", total: 291, category: "Peak Performer", when: "Runner-up" },
  { name: "Riya Sharma",   contact: "Sharjah",   total: 285, category: "Peak Performer", when: "3rd place" },
  { name: "Khalid M.",     contact: "Ajman",     total: 274, category: "Peak Performer", when: "Top 5" },
  { name: "Fatima H.",     contact: "Dubai",     total: 270, category: "Peak Performer", when: "Top 5" },
];

const mask = (c: string) => {
  if (c.includes("@")) {
    const [a, b] = c.split("@");
    return a.slice(0, 2) + "•••@" + b;
  }
  if (c.length > 4) return c.slice(0, 3) + "•••" + c.slice(-2);
  return c;
};

const fromUser = (u: UserRecord, when: string): LeaderEntry => ({
  name: u.name || "Player",
  contact: mask(u.contact),
  total: u.total,
  category: u.category,
  when,
});

export const getDailyLeaderboard = (): LeaderEntry[] => {
  const users = getAllUsers().map((u) => fromUser(u, "Today"));
  return [...users, ...SAMPLE_DAILY].sort((a, b) => b.total - a.total).slice(0, 5);
};

export const getGlobalLeaderboard = (): LeaderEntry[] => {
  const users = getAllUsers().map((u) => fromUser(u, "All-time"));
  return [...users, ...SAMPLE_GLOBAL].sort((a, b) => b.total - a.total).slice(0, 5);
};

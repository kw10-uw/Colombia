export const people = [
  { id: "gaba", name: "Gaba", color: "#f8cf53" },
  { id: "janek", name: "Janek", color: "#f2b3a3" },
  { id: "konrad", name: "Konrad", color: "#b6d4bc" },
  { id: "julia", name: "Julia", color: "#cdb5e1" },
] as const;
export type Person = (typeof people)[number]["id"];
export type Currency = "COP" | "EUR" | "PLN" | "USD";
export type Kind =
  | "destination"
  | "activity"
  | "travel"
  | "stay"
  | "idea"
  | "document"
  | "expense"
  | "settlement";
export type Data = {
  title: string;
  city?: string;
  date?: string;
  endDate?: string;
  time?: string;
  notes?: string;
  url?: string;
  category?: string;
  status?: string;
  order?: number;
  amount?: number;
  currency?: Currency;
  rate?: number;
  paidBy?: Person;
  split?: Person[];
  shares?: Partial<Record<Person, number>>;
  votes?: Person[];
  person?: Person;
  to?: Person;
  source?: string;
  sourceDate?: string;
  activityId?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  cloudPath?: string;
  isStarter?: boolean;
  chapterId?: string;
  stayIds?: string[];
  fromChapterId?: string;
  toChapterId?: string;
  mode?: string;
  endTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departurePlace?: string;
  arrivalPlace?: string;
  bookingRef?: string;
};
export type Row = {
  id: string;
  kind: Kind;
  data: Data;
  by: Person;
  updatedAt: string;
  deleted?: boolean;
  revision: number;
  dirty: boolean;
  conflict?: RemoteRow;
};
export type RemoteRow = {
  id: string;
  kind: Kind;
  data: Data;
  by: Person;
  updated_at: string;
  deleted: boolean;
  revision: number;
};
export type Settings = {
  person?: Person;
  rate: number;
  plnRate: number;
  usdRate: number;
  rateDate?: string;
  rateSource?: string;
  startDate?: string;
  endDate?: string;
  tripName: string;
  budget: number;
  cloud?: { url: string; key: string; tripId: string; invite: string };
  onboardingDone?: boolean;
};
export const defaults: Settings = {
  rate: 4500,
  plnRate: 4.3,
  usdRate: 1.08,
  tripName: "Our Colombia adventure",
  budget: 0,
};
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function localDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
export function formatDate(date?: string) {
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(new Date(date + "T12:00:00"))
    : "Dates to decide";
}
export function money(n: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(n);
}
export function rateFor(currency: Currency, settings: Settings) {
  return currency === "COP"
    ? settings.rate
    : currency === "PLN"
      ? settings.plnRate
      : currency === "USD"
        ? settings.usdRate
        : 1;
}
export function toCents(data: Data) {
  return Math.round(((data.amount || 0) / (data.rate || 1)) * 100);
}
export function allocate(
  cents: number,
  members: readonly Person[],
): Partial<Record<Person, number>> {
  if (!members.length)
    throw new Error("Choose at least one person to split with.");
  const base = Math.floor(cents / members.length),
    remainder = cents - base * members.length;
  return Object.fromEntries(
    members.map((p, i) => [p, base + (i < remainder ? 1 : 0)]),
  );
}
export function balances(rows: Row[]) {
  const result: Record<Person, number> = {
    gaba: 0,
    janek: 0,
    konrad: 0,
    julia: 0,
  };
  rows
    .filter((r) => !r.deleted)
    .forEach((r) => {
      if (r.kind === "expense" && r.data.paidBy) {
        const cents = toCents(r.data);
        result[r.data.paidBy] += cents;
        const shares =
          r.data.shares ||
          allocate(cents, r.data.split || people.map((p) => p.id));
        Object.entries(shares).forEach(([p, n]) => {
          result[p as Person] -= n || 0;
        });
      }
      if (r.kind === "settlement" && r.data.paidBy && r.data.to) {
        const cents = toCents(r.data);
        result[r.data.paidBy] += cents;
        result[r.data.to] -= cents;
      }
    });
  return result;
}
export function transfers(balance: Record<Person, number>) {
  const debtors = people
    .map((p) => ({ person: p.id, value: -balance[p.id] }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  const creditors = people
    .map((p) => ({ person: p.id, value: balance[p.id] }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  const result: { from: Person; to: Person; cents: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].value, creditors[j].value);
    result.push({ from: debtors[i].person, to: creditors[j].person, cents });
    debtors[i].value -= cents;
    creditors[j].value -= cents;
    if (!debtors[i].value) i++;
    if (!creditors[j].value) j++;
  }
  return result;
}
export function validUrl(url?: string) {
  try {
    const u = new URL(url || "");
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function newRow(kind: Kind, data: Data, by: Person): Row {
  return {
    id: id(),
    kind,
    data,
    by,
    updatedAt: now(),
    revision: 0,
    dirty: true,
  };
}
export const kinds: Kind[] = [
  "destination",
  "activity",
  "travel",
  "stay",
  "idea",
  "document",
  "expense",
  "settlement",
];
export function isRow(value: unknown): value is Row {
  if (!value || typeof value !== "object") return false;
  const r = value as Row;
  return (
    typeof r.id === "string" &&
    /^[a-f0-9-]{36}$/.test(r.id) &&
    kinds.includes(r.kind) &&
    !!r.data &&
    typeof r.data.title === "string" &&
    people.some((p) => p.id === r.by) &&
    Number.isInteger(r.revision) &&
    typeof r.updatedAt === "string"
  );
}
export function remapLinks(
  data: Data,
  map: Map<string, string>,
): Partial<Data> {
  return {
    activityId: map.get(data.activityId || "") || undefined,
    chapterId: map.get(data.chapterId || "") || undefined,
    fromChapterId: map.get(data.fromChapterId || "") || undefined,
    toChapterId: map.get(data.toChapterId || "") || undefined,
    stayIds: data.stayIds
      ?.map((id) => map.get(id))
      .filter((id): id is string => !!id),
  };
}

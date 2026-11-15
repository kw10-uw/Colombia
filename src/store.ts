import { openDB } from "idb";
import {
  defaults,
  newRow,
  now,
  type Data,
  type Kind,
  type Row,
  type Settings,
  type Person,
} from "./model";
import { starterRows } from "./seeds";

const dbPromise = openDB("turbocolombia-v1", 1, {
  upgrade(db) {
    db.createObjectStore("rows", { keyPath: "id" });
    db.createObjectStore("files");
    db.createObjectStore("settings");
  },
});
type Snapshot = {
  rows: Row[];
  settings: Settings;
  ready: boolean;
  error?: string;
};
let snapshot: Snapshot = { rows: [], settings: defaults, ready: false };
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSnapshot = () => snapshot;
function emit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}
export async function initialize() {
  try {
    const db = await dbPromise;
    const settings = { ...defaults, ...(await db.get("settings", "app")) };
    const rows = await db.getAll("rows");
    emit({ settings, rows, ready: true });
  } catch {
    emit({
      ready: true,
      error:
        "This browser could not open device storage. Allow site storage, then reload. Your changes cannot be saved yet.",
    });
  }
}
export async function saveSettings(changes: Partial<Settings>) {
  const settings = { ...snapshot.settings, ...changes };
  await (await dbPromise).put("settings", settings, "app");
  emit({ settings });
}
export async function putRow(row: Row) {
  await (await dbPromise).put("rows", row);
  emit({ rows: [...snapshot.rows.filter((r) => r.id !== row.id), row] });
  return row;
}
export async function addRow(kind: Kind, data: Data, person?: Person) {
  return putRow(
    newRow(kind, data, person || snapshot.settings.person || "konrad"),
  );
}
export async function editRow(row: Row, data: Partial<Data>) {
  const latest = snapshot.rows.find((r) => r.id === row.id) || row;
  return putRow({
    ...latest,
    data: { ...latest.data, ...data },
    updatedAt: now(),
    by: snapshot.settings.person || row.by,
    dirty: true,
  });
}
export async function deleteRow(row: Row) {
  const latest = snapshot.rows.find((r) => r.id === row.id) || row;
  if(row.kind === "document" && !snapshot.settings.cloud) await removeFile(row.id);
  return putRow({
    ...latest,
    deleted: true,
    updatedAt: now(),
    by: snapshot.settings.person || row.by,
    dirty: true,
  });
}
export async function setFile(rowId: string, file: Blob) {
  await (await dbPromise).put("files", file, rowId);
  if(typeof window !== 'undefined')window.dispatchEvent(new Event('turbo:files'));
}
export async function getFile(rowId: string): Promise<Blob | undefined> {
  return (await dbPromise).get("files", rowId);
}
export async function removeFile(rowId: string) {
  await (await dbPromise).delete("files", rowId);
  if(typeof window !== 'undefined')window.dispatchEvent(new Event('turbo:files'));
}
export async function replaceRows(rows: Row[], clearFiles = false) {
  const db = await dbPromise;
  const tx = db.transaction(
    clearFiles ? ["rows", "files"] : ["rows"],
    "readwrite",
  );
  await tx.objectStore("rows").clear();
  if (clearFiles) await tx.objectStore("files").clear();
  for (const row of rows) await tx.objectStore("rows").put(row);
  await tx.done;
  emit({ rows });
}
export async function startTrip(person: Person, withStops: boolean) {
  if (withStops) for (const row of starterRows(person)) await putRow(row);
  await saveSettings({ person, onboardingDone: true });
}
export async function storageEstimate() {
  return navigator.storage?.estimate?.();
}

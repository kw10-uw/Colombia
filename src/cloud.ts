import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSnapshot,
  saveSettings,
  putRow,
  replaceRows,
  getFile,
  setFile,
  removeFile,
} from "./store";
import type { RemoteRow, Row, Settings } from "./model";
let client: SupabaseClient | undefined;
let clientKey = "";
let busy = false;
export type SyncState = {
  phase: "local" | "offline" | "syncing" | "synced" | "error";
  message: string;
  lastSync?: string;
};
let status: SyncState = { phase: "local", message: "Saved on this phone" };
const listeners = new Set<() => void>();
export const syncSubscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const syncSnapshot = () => status;
function update(next: SyncState) {
  status = next;
  listeners.forEach((l) => l());
}
export function getClient(config = getSnapshot().settings.cloud) {
  if (!config) throw Error("Connect your trip in Settings first.");
  const key = config.url + config.key;
  if (!client || clientKey !== key) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    clientKey = key;
  }
  return client;
}
async function authenticate(c: SupabaseClient) {
  const { data, error } = await c.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const result = await c.auth.signInAnonymously();
    if (result.error) throw result.error;
  }
}
function fromRemote(r: RemoteRow): Row {
  return {
    id: r.id,
    kind: r.kind,
    data: r.data,
    by: r.by,
    updatedAt: r.updated_at,
    deleted: r.deleted,
    revision: r.revision,
    dirty: false,
  };
}
export async function connectTrip(url: string, key: string, invite?: string) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))
    throw Error("Enter your Supabase project URL (https://….supabase.co).");
  if (key.startsWith("sb_secret_"))
    throw Error("Use a publishable or anon key, never a secret key.");
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role === "service_role")
        throw Error("A service-role key must never be used in the app.");
    } catch (error) {
      throw error instanceof Error ? error : Error("Invalid key.");
    }
  }
  const config = {
    url: url.replace(/\/$/, ""),
    key,
    tripId: "",
    invite:
      invite ||
      crypto.randomUUID().replaceAll("-", "") +
        crypto.randomUUID().replaceAll("-", ""),
  };
  const c = getClient(config);
  await authenticate(c);
  if (invite) {
    const { data, error } = await c.rpc("join_trip", { invite_code: invite });
    if (error) throw error;
    config.tripId = data;
    const fetched = await c
      .from("trip_records")
      .select("*")
      .eq("trip_id", data);
    if (fetched.error) throw fetched.error;
    await replaceRows((fetched.data as RemoteRow[]).map(fromRemote), true);
  } else {
    const { data, error } = await c.rpc("create_trip", {
      trip_name: getSnapshot().settings.tripName,
      invite_code: config.invite,
    });
    if (error) throw error;
    config.tripId = data;
    for (const row of getSnapshot().rows)
      await putRow({ ...row, revision: 0, dirty: true, conflict: undefined });
  }
  await saveSettings({ cloud: config });
  await syncTrip();
}
export async function disconnectTrip() {
  await saveSettings({ cloud: undefined });
  client = undefined;
  clientKey = "";
  update({ phase: "local", message: "Saved on this phone" });
}
export function inviteLink() {
  const config = getSnapshot().settings.cloud;
  if (!config) return "";
  const url = new URL(location.href);
  url.hash = "join=" + btoa(JSON.stringify(config));
  return url.href;
}
export async function syncTrip() {
  if (busy) return;
  const config = getSnapshot().settings.cloud;
  if (!config) {
    update({ phase: "local", message: "Saved on this phone" });
    return;
  }
  if (!navigator.onLine) {
    update({ phase: "offline", message: "Offline · changes waiting to sync" });
    return;
  }
  busy = true;
  update({ phase: "syncing", message: "Syncing the crew…" });
  try {
    const c = getClient();
    await authenticate(c);
    for (const pending of getSnapshot().rows.filter(
      (r) => r.dirty && !r.conflict,
    )) {
      let outgoing = { ...pending, data: { ...pending.data } };
      if (
        outgoing.kind === "document" &&
        !outgoing.deleted &&
        !outgoing.data.cloudPath
      ) {
        const blob = await getFile(outgoing.id);
        if (!blob)
          throw Error(
            "A document is missing its file on this phone. Reattach it before syncing.",
          );
        const cloudPath = `${config.tripId}/${outgoing.id}`;
        const result = await c.storage
          .from("trip-documents")
          .upload(cloudPath, blob, {
            upsert: true,
            contentType: outgoing.data.mime || "application/octet-stream",
          });
        if (result.error) throw result.error;
        outgoing.data.cloudPath = cloudPath;
      }
      const result = await c.rpc("save_trip_record", {
        p_trip_id: config.tripId,
        p_id: outgoing.id,
        p_kind: outgoing.kind,
        p_data: outgoing.data,
        p_by: outgoing.by,
        p_deleted: !!outgoing.deleted,
        p_revision: outgoing.revision,
      });
      if (result.error) {
        if (result.error.message.includes("RECORD_CONFLICT")) {
          const remote = await c
            .from("trip_records")
            .select("*")
            .eq("trip_id", config.tripId)
            .eq("id", outgoing.id)
            .single();
          if (remote.error) throw remote.error;
          const latest = getSnapshot().rows.find((r) => r.id === pending.id);
          if (latest) await putRow({ ...latest, conflict: remote.data });
          continue;
        }
        throw result.error;
      }
      const remote = result.data as RemoteRow;
      const latest = getSnapshot().rows.find((r) => r.id === pending.id);
      if (latest === pending) await putRow(fromRemote(remote));
      else if (latest)
        await putRow({
          ...latest,
          revision: remote.revision,
          data: {
            ...latest.data,
            ...(outgoing.data.cloudPath
              ? { cloudPath: outgoing.data.cloudPath }
              : {}),
          },
        });
      if (outgoing.deleted && outgoing.kind === "document") {
        const cloudPath =
          outgoing.data.cloudPath || `${config.tripId}/${outgoing.id}`;
        const removed = await c.storage
          .from("trip-documents")
          .remove([cloudPath]);
        if (removed.error)
          console.warn(
            "Document storage cleanup pending",
            removed.error.message,
          );
        await removeFile(outgoing.id);
      }
    }
    const fetched = await c
      .from("trip_records")
      .select("*")
      .eq("trip_id", config.tripId);
    if (fetched.error) throw fetched.error;
    for (const remote of fetched.data as RemoteRow[]) {
      const local = getSnapshot().rows.find((r) => r.id === remote.id);
      if (!local || (!local.dirty && remote.revision > local.revision))
        await putRow(fromRemote(remote));
    }
    const conflicts = getSnapshot().rows.filter((r) => r.conflict).length;
    update({
      phase: conflicts ? "error" : "synced",
      message: conflicts
        ? `${conflicts} edit conflict${conflicts === 1 ? "" : "s"} · review in Settings`
        : "All caught up",
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    update({
      phase: "error",
      message:
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message ||
            "Could not sync. Your changes remain on this phone.",
    });
  } finally {
    busy = false;
  }
}
export async function resolveConflict(row: Row, keepLocal: boolean) {
  if (!row.conflict) return;
  if (keepLocal)
    await putRow({
      ...row,
      revision: row.conflict.revision,
      conflict: undefined,
      dirty: true,
    });
  else await putRow(fromRemote(row.conflict));
  await syncTrip();
}
export async function downloadDocument(row: Row) {
  let blob = await getFile(row.id);
  if (blob) return blob;
  if (!row.data.cloudPath)
    throw Error(
      "This file is not on this phone. Connect to the trip to download it.",
    );
  const { data, error } = await getClient()
    .storage.from("trip-documents")
    .download(row.data.cloudPath);
  if (error) throw error;
  blob = data;
  await setFile(row.id, blob);
  return blob;
}
export async function cacheAllDocuments() {
  for (const row of getSnapshot().rows.filter(
    (r) => r.kind === "document" && !r.deleted,
  ))
    await downloadDocument(row);
  await navigator.storage?.persist?.();
}
export function cloudConfig(): Settings["cloud"] {
  return getSnapshot().settings.cloud;
}

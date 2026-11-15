import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeAll } from "vitest";
const fake = vi.hoisted(() => ({
  remote: new Map<string, any>(),
  onSave: undefined as undefined | (() => Promise<void>),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "device" } } },
        error: null,
      }),
    },
    rpc: async (name: string, p: any) => {
      if (name === "create_trip")
        return { data: "00000000-0000-0000-0000-000000000001", error: null };
      if (name === "save_trip_record") {
        const old = fake.remote.get(p.p_id);
        if ((old?.revision || 0) !== p.p_revision)
          return { error: { message: "RECORD_CONFLICT" } };
        const remote = {
          id: p.p_id,
          kind: p.p_kind,
          data: p.p_data,
          by: p.p_by,
          updated_at: new Date().toISOString(),
          deleted: p.p_deleted,
          revision: p.p_revision + 1,
        };
        fake.remote.set(remote.id, remote);
        if (fake.onSave) {
          const cb = fake.onSave;
          fake.onSave = undefined;
          await cb();
        }
        return { data: remote, error: null };
      }
      return { error: { message: "Unexpected RPC" } };
    },
    from: () => ({
      select: () => ({
        eq: (_key: string, value: string) => ({
          then: (resolve: any) =>
            resolve({ data: [...fake.remote.values()], error: null }),
          eq: (_field: string, rowId: string) => ({
            single: async () => ({ data: fake.remote.get(rowId), error: null }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));
import {
  initialize,
  saveSettings,
  addRow,
  editRow,
  getSnapshot,
  replaceRows,
} from "./store";
import { syncTrip, syncSnapshot, resolveConflict } from "./cloud";
beforeAll(async () => {
  vi.stubGlobal("navigator", { onLine: true });
  await initialize();
  await saveSettings({
    person: "konrad",
    cloud: {
      url: "https://test.supabase.co",
      key: "sb_publishable_test",
      tripId: "00000000-0000-0000-0000-000000000001",
      invite: "a".repeat(64),
    },
  });
});
describe("offline and concurrent sync", () => {
  it("keeps an offline edit dirty, then uploads when back online", async () => {
    await replaceRows([]);
    fake.remote.clear();
    const row = await addRow("activity", {
      title: "Original",
      city: "Cartagena",
    });
    vi.stubGlobal("navigator", { onLine: false });
    await syncTrip();
    expect(getSnapshot().rows[0].dirty).toBe(true);
    expect(syncSnapshot().phase).toBe("offline");
    vi.stubGlobal("navigator", { onLine: true });
    await syncTrip();
    expect(getSnapshot().rows[0].dirty).toBe(false);
    expect(fake.remote.get(row.id).revision).toBe(1);
  });
  it("never drops a new local edit made while an earlier save is in flight", async () => {
    await replaceRows([]);
    fake.remote.clear();
    const row = await addRow("activity", { title: "First", city: "Bogotá" });
    fake.onSave = async () => {
      await editRow(row, { title: "Edited during upload" });
    };
    await syncTrip();
    const current = getSnapshot().rows[0];
    expect(current.data.title).toBe("Edited during upload");
    expect(current.dirty).toBe(true);
    expect(current.revision).toBe(1);
    await syncTrip();
    expect(fake.remote.get(row.id).data.title).toBe("Edited during upload");
    expect(getSnapshot().rows[0].dirty).toBe(false);
  });
  it("preserves both sides of a conflict until the user chooses", async () => {
    await replaceRows([]);
    fake.remote.clear();
    let row = await addRow("activity", { title: "First", city: "Bogotá" });
    await syncTrip();
    row = getSnapshot().rows[0];
    await editRow(row, { title: "My offline idea" });
    fake.remote.set(row.id, {
      ...fake.remote.get(row.id),
      revision: 2,
      data: { title: "The crew’s idea", city: "Bogotá" },
    });
    // Shape the mock's single-row query for the conflict path.
    await syncTrip();
    const conflicted = getSnapshot().rows[0];
    expect(conflicted.data.title).toBe("My offline idea");
    expect(conflicted.conflict?.data.title).toBe("The crew’s idea");
    await resolveConflict(conflicted, false);
    expect(getSnapshot().rows[0].data.title).toBe("The crew’s idea");
    expect(getSnapshot().rows[0].dirty).toBe(false);
  });
});

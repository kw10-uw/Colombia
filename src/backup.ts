import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { getSnapshot, getFile, setFile, putRow } from "./store";
import { isRow, id, now, remapLinks } from "./model";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportBackup() {
  const { rows, settings } = getSnapshot();
  const active = rows.filter((r) => !r.deleted);
  const files: Record<string, Uint8Array> = {};
  files["trip.json"] = strToU8(
    JSON.stringify(
      {
        version: 1,
        exportedAt: now(),
        tripName: settings.tripName,
        rows: active.map((r) => ({ ...r, conflict: undefined })),
      },
      null,
      2,
    ),
  );
  let missing = 0;
  for (const row of active.filter((r) => r.kind === "document")) {
    const file = await getFile(row.id);
    if (file)
      files[`documents/${row.id}`] = new Uint8Array(await file.arrayBuffer());
    else missing++;
  }
  const zipped = zipSync(files, { level: 1 });
  download(
    new Blob([zipped as BlobPart], { type: "application/zip" }),
    `turbocolombia-${new Date().toISOString().slice(0, 10)}.zip`,
  );
  return missing;
}
export async function importBackup(file: File) {
  if (file.size > 60 * 1024 * 1024)
    throw Error("Backup is too large (maximum 60 MB).");
  let expanded = 0;
  const contents = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > 150 * 1024 * 1024)
        throw Error("Expanded backup exceeds 150 MB.");
      return (
        entry.name === "trip.json" ||
        /^documents\/[a-f0-9-]{36}$/.test(entry.name)
      );
    },
  });
  if (!contents["trip.json"])
    throw Error("This is not a TurboColombia backup.");
  const data = JSON.parse(strFromU8(contents["trip.json"]));
  if (
    data.version !== 1 ||
    !Array.isArray(data.rows) ||
    data.rows.length > 10000 ||
    !data.rows.every(isRow)
  )
    throw Error("This backup format is not supported.");
  const map = new Map<string, string>(
    data.rows.map((r: { id: string }) => [r.id, id()]),
  );
  for (const original of data.rows) {
    const row = {
      ...original,
      id: map.get(original.id),
      revision: 0,
      dirty: true,
      conflict: undefined,
      updatedAt: now(),
      data: {
        ...original.data,
        cloudPath: undefined,
        ...remapLinks(original.data, map),
      },
    };
    if (row.kind === "document") {
      const bytes = contents[`documents/${original.id}`];
      if (!bytes) continue;
      await setFile(
        row.id,
        new Blob([bytes as BlobPart], { type: row.data.mime }),
      );
    }
    await putRow(row);
  }
  return data.rows.length;
}

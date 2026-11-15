import { useState, type FormEvent } from "react";
import { Check, Paperclip } from "lucide-react";
import {
  people,
  allocate,
  rateFor,
  toCents,
  money,
  newRow,
  type Data,
  type Row,
  type Kind,
  type Person,
  type Currency,
  type Settings,
} from "./model";
import { addRow, editRow, setFile, getSnapshot, putRow } from "./store";
import { Field, Avatar } from "./components";

export type Editor = { kind: Kind; row?: Row; preset?: Partial<Data> };
export function EntityForm({
  editor,
  rows,
  settings,
  onSaved,
}: {
  editor: Editor;
  rows: Row[];
  settings: Settings;
  onSaved: () => void;
}) {
  const { kind, row } = editor;
  const [data, setData] = useState<Data>({
    title: "",
    city: editor.preset?.city || "",
    currency: "COP",
    paidBy: settings.person || "konrad",
    split: people.map((p) => p.id),
    category: kind === "expense" ? "Food & drink" : "Sight",
    status: "Planned",
    ...editor.preset,
    ...row?.data,
  });
  const [file, setSelectedFile] = useState<File>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState(!!data.shares);
  const [customValues, setCustomValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      people.map((p) => [
        p.id,
        row?.data.shares
          ? String(
              (
                ((row.data.shares[p.id] || 0) / 100) *
                (row.data.rate || 1)
              ).toFixed(data.currency === "COP" ? 0 : 2),
            )
          : "",
      ]),
    ),
  );
  const [rate, setRate] = useState(
    row?.data.rate || rateFor(data.currency || "COP", settings),
  );
  const set = (key: keyof Data, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));
  const destinations = rows.filter(
    (r) => r.kind === "destination" && !r.deleted,
  );
  const isExpense = kind === "expense";
  const isDocument = kind === "document";
  const cityField = (
    <Field label="Destination">
      <input
        list="destination-options"
        value={data.city || ""}
        onChange={(e) => set("city", e.target.value)}
        placeholder="e.g. Cartagena"
        required={kind === "activity" || kind === "stay"}
      />
      <datalist id="destination-options">
        {destinations.map((d) => (
          <option key={d.id} value={d.data.title} />
        ))}
      </datalist>
    </Field>
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const clean = {
        ...data,
        title: data.title.trim(),
        city: data.city?.trim(),
      };
      if (!clean.title) throw Error("Give this a name.");
      if (clean.date && clean.endDate && clean.endDate < clean.date)
        throw Error("The end date must be after the start date.");
      if (isExpense) {
        if (!Number.isFinite(data.amount) || !data.amount || data.amount <= 0)
          throw Error("Enter an amount greater than zero.");
        if (!Number.isFinite(rate) || rate <= 0)
          throw Error("Enter a valid exchange rate.");
        if (!data.split?.length) throw Error("Choose at least one person.");
        clean.rate = rate;
        const cents = toCents(clean);
        if (custom) {
          const values = data.split.map((p) => Number(customValues[p] || 0));
          if (values.some((v) => !Number.isFinite(v) || v < 0))
            throw Error("Shares must be zero or greater.");
          const total = values.reduce((a, b) => a + b, 0);
          if (Math.abs(total - data.amount) > 0.011)
            throw Error("Custom shares must add up to the expense amount.");
          clean.shares = Object.fromEntries(
            data.split.map((p, i) => [p, Math.round((values[i] / rate) * 100)]),
          );
          const delta =
            cents -
            Object.values(clean.shares).reduce((a, b) => a + (b || 0), 0);
          clean.shares[data.split[data.split.length - 1]]! += delta;
        } else clean.shares = allocate(cents, data.split);
      }
      if (isDocument && !row && !file)
        throw Error("Choose a document or image to attach.");
      if (file) {
        if (file.size > 15 * 1024 * 1024)
          throw Error("Choose a file smaller than 15 MB.");
        if (
          ![
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
            "text/plain",
          ].includes(file.type)
        )
          throw Error("Use a PDF, photo (JPG, PNG, WebP, HEIC), or text file.");
        clean.fileName = file.name;
        clean.mime = file.type;
        clean.size = file.size;
      }
      if (file && !row) {
        const created = newRow(kind, clean, settings.person || "konrad");
        await setFile(created.id, file);
        await putRow(created);
      } else if (row) await editRow(row, clean);
      else
        await addRow(kind, {
          ...clean,
          order: clean.order ?? rows.filter((r) => r.kind === kind).length,
        });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="entity-form">
      <Field
        label={
          kind === "destination"
            ? "Destination name"
            : isExpense
              ? "What was it for?"
              : isDocument
                ? "Document name"
                : "Name"
        }
      >
        <input
          value={data.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={
            kind === "stay"
              ? "A courtyard in Getsemaní"
              : isExpense
                ? "Dinner with the crew"
                : isDocument
                  ? "Flight confirmation"
                  : kind === "activity"
                    ? "A little adventure…"
                    : "Give it a name"
          }
          required
          maxLength={180}
        />
      </Field>
      {kind !== "destination" && cityField}
      {(kind === "destination" || kind === "stay") && (
        <div className="form-grid">
          <Field label={kind === "stay" ? "Check-in" : "Arrive"}>
            <input
              type="date"
              value={data.date || ""}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label={kind === "stay" ? "Check-out" : "Leave"}>
            <input
              type="date"
              value={data.endDate || ""}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
        </div>
      )}
      {(kind === "activity" || isExpense) && (
        <div className="form-grid">
          <Field label="Date">
            <input
              type="date"
              value={data.date || ""}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          {kind === "activity" && (
            <Field label="Time">
              <input
                type="time"
                value={data.time || ""}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
          )}
        </div>
      )}
      {kind === "activity" && (
        <div className="form-grid">
          <Field label="Type">
            <select
              value={data.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {[
                "Sight",
                "Food",
                "Transport",
                "Flight",
                "Stay",
                "Free time",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={data.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {["Planned", "Booked", "Done"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {kind === "idea" && (
        <div className="form-grid">
          <Field label="Type">
            <select
              value={data.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {["Food", "Sight", "Experience"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <input
              value={data.source || ""}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Reddit, a friend, a guide…"
            />
          </Field>
        </div>
      )}
      {kind === "stay" && (
        <Field label="Status">
          <select
            value={data.status === "Planned" ? "Shortlisted" : data.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {["Shortlisted", "Favorite", "Booked"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      )}
      {(kind === "stay" || isExpense) && (
        <>
          <div className="form-grid">
            <Field
              label={kind === "stay" ? "Total stay price (optional)" : "Amount"}
            >
              <input
                type="number"
                min={isExpense ? "0.01" : "0"}
                step="0.01"
                value={data.amount ?? ""}
                onChange={(e) =>
                  set(
                    "amount",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
                required={isExpense}
                inputMode="decimal"
              />
            </Field>
            <Field label="Currency">
              <select
                value={data.currency}
                onChange={(e) => {
                  const currency = e.target.value as Currency;
                  set("currency", currency);
                  setRate(rateFor(currency, settings));
                }}
              >
                {["COP", "EUR", "PLN", "USD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          {isExpense && (
            <>
              <Field
                label={
                  data.currency === "EUR"
                    ? "EUR rate"
                    : "Exchange rate · 1 EUR equals"
                }
                hint="This rate is saved with the expense so old balances stay stable."
              >
                <div className="input-unit">
                  <input
                    type="number"
                    value={rate}
                    min="0.000001"
                    step="any"
                    onChange={(e) => setRate(Number(e.target.value))}
                    readOnly={data.currency === "EUR"}
                    required
                  />
                  <span>{data.currency}</span>
                </div>
              </Field>
              <div className="form-grid">
                <Field label="Paid by">
                  <select
                    value={data.paidBy}
                    onChange={(e) => set("paidBy", e.target.value)}
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={data.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {[
                      "Food & drink",
                      "Accommodation",
                      "Transport",
                      "Activities",
                      "Shopping",
                      "Other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <fieldset className="split-field">
                <legend>Split between</legend>
                <div className="split-people">
                  {people.map((p) => (
                    <label
                      key={p.id}
                      className={data.split?.includes(p.id) ? "checked" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={data.split?.includes(p.id) || false}
                        onChange={(e) =>
                          set(
                            "split",
                            e.target.checked
                              ? [...(data.split || []), p.id]
                              : (data.split || []).filter((id) => id !== p.id),
                          )
                        }
                      />
                      <Avatar person={p.id} size={36} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="check">
                <input
                  type="checkbox"
                  checked={custom}
                  onChange={(e) => setCustom(e.target.checked)}
                />
                Use custom amounts
              </label>
              {custom && (
                <div className="form-grid">
                  {data.split?.map((p) => (
                    <Field
                      key={p}
                      label={`${people.find((x) => x.id === p)?.name} · ${data.currency}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customValues[p] || ""}
                        onChange={(e) =>
                          setCustomValues((v) => ({
                            ...v,
                            [p]: e.target.value,
                          }))
                        }
                        inputMode="decimal"
                        required
                      />
                    </Field>
                  ))}
                </div>
              )}
              <p className="help">
                {money((data.amount || 0) / rate)} total · recorded by{" "}
                {people.find((p) => p.id === settings.person)?.name}
              </p>
            </>
          )}
        </>
      )}
      {["activity", "stay", "idea"].includes(kind) && (
        <Field
          label={kind === "stay" ? "Booking / Airbnb link" : "Link (optional)"}
        >
          <input
            type="url"
            value={data.url || ""}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
      )}
      {isDocument && (
        <>
          <Field label="Attach to a plan, stay, or expense (optional)">
            <select
              value={data.activityId || ""}
              onChange={(e) => set("activityId", e.target.value)}
            >
              <option value="">General trip document</option>
              {rows
                .filter(
                  (r) =>
                    !r.deleted &&
                    ["activity", "stay", "expense"].includes(r.kind),
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.data.title}
                    {r.data.city ? ` · ${r.data.city}` : ""}
                  </option>
                ))}
            </select>
          </Field>
          {!row && (
            <Field
              label="PDF, photo, or text file"
              hint="Up to 15 MB. Kept on this phone; shared after your trip is connected."
            >
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setSelectedFile(f);
                  if (f && !data.title)
                    set("title", f.name.replace(/\.[^.]+$/, ""));
                }}
                required
              />
            </Field>
          )}
          {row && (
            <p className="help">
              <Paperclip size={14} />
              {row.data.fileName}
            </p>
          )}
        </>
      )}
      <Field label="Notes (optional)">
        <textarea
          value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="The little details worth keeping…"
          rows={3}
        />
      </Field>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer className="form-actions">
        <span className="help">
          {getSnapshot().settings.cloud
            ? "Saved here, then synced to the crew"
            : "Saved on this phone"}
        </span>
        <button className="button primary" type="submit" disabled={saving}>
          {saving
            ? "Saving…"
            : row
              ? "Save changes"
              : isDocument
                ? "Save document"
                : "Add to the trip"}
          <Check size={16} />
        </button>
      </footer>
    </form>
  );
}

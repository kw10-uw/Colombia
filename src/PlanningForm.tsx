import { useState, type FormEvent } from "react";
import {
  MapPin,
  CalendarDays,
  BedDouble,
  Plane,
  Bus,
  TrainFront,
  Car,
  Ship,
  Route,
  Camera,
  Utensils,
  Coffee,
  Sun,
  Check,
  Paperclip,
  ArrowRight,
} from "lucide-react";
import { type Data, type Row, type Settings, newRow, now } from "./model";
import { type Editor } from "./forms";
import { Field } from "./components";
import { orderedChapters, chapterFor, travelModes } from "./planning";
import { getSnapshot, commitRows } from "./store";
export const modeIcons = {
  Plane,
  Bus,
  Train: TrainFront,
  Car,
  Boat: Ship,
  Other: Route,
};
const activityTypes = [
  ["Sight", "See & explore", Camera],
  ["Food", "Eat something good", Utensils],
  ["Free time", "Take it slow", Coffee],
  ["Transport", "Get around", Route],
] as const;
export function editorTitle(editor: Editor) {
  const action = editor.row ? "Edit" : "Add";
  return editor.kind === "destination"
    ? editor.row
      ? "Shape this chapter"
      : "Where to next?"
    : editor.kind === "activity"
      ? editor.row
        ? "Make this plan yours"
        : "What’s the plan?"
      : editor.kind === "travel"
        ? editor.row
          ? "Fine-tune the journey"
          : "Connect the chapters"
        : editor.kind === "stay"
          ? editor.row
            ? "Our home away from home"
            : "Find our little corner"
          : `${action} ${editor.kind === "expense" ? "an expense" : editor.kind === "idea" ? "an idea" : "a document"}`;
}
export function PlanningForm({
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
  const chapters = orderedChapters(rows);
  const matched = row ? chapterFor(row, chapters) : undefined;
  const presetChapter =
    chapters.find((c) => c.id === editor.preset?.chapterId) ||
    chapters.find((c) => c.data.title === editor.preset?.city);
  const [data, setData] = useState<Data>(() => {
    const initial: Data = {
      title: "",
      category: "Sight",
      status: kind === "stay" ? "Shortlisted" : "Planned",
      currency: "EUR",
      mode: "Plane",
      chapterId: matched?.id || presetChapter?.id,
      city: matched?.data.title || presetChapter?.data.title || "",
      ...editor.preset,
      ...row?.data,
    };
    if (initial.chapterId && !chapters.some((c) => c.id === initial.chapterId))
      initial.chapterId = undefined;
    return initial;
  });
  const [file, setFile] = useState<File>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Data, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));
  const currentChapter = chapters.find((c) => c.id === data.chapterId);
  const destination = kind === "destination",
    activity = kind === "activity",
    travel = kind === "travel",
    stay = kind === "stay";
  const mode = travelModes.includes(data.mode as any)
    ? (data.mode as keyof typeof modeIcons)
    : "Other";
  const ModeIcon = modeIcons[mode];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const clean: Data = {
        ...data,
        title: data.title.trim(),
        city: data.city?.trim(),
        isStarter: false,
      };
      if (travel) {
        if (
          !data.fromChapterId ||
          !data.toChapterId ||
          data.fromChapterId === data.toChapterId
        )
          throw Error("Choose two different chapters for this journey.");
        const from = chapters.find((c) => c.id === data.fromChapterId),
          to = chapters.find((c) => c.id === data.toChapterId);
        if (!from || !to)
          throw Error("Choose chapters that are still in your route.");
        clean.title = clean.title || `${from.data.title} → ${to.data.title}`;
        clean.city = from.data.title;
        if (
          clean.arrivalDate &&
          clean.date &&
          `${clean.arrivalDate}T${clean.arrivalTime || "23:59"}` <
            `${clean.date}T${clean.time || "00:00"}`
        )
          throw Error(
            "Arrival must be after departure. All journey times use Colombia time.",
          );
      }
      if (!clean.title) throw Error("Give this part of the adventure a name.");
      if (activity || stay) {
        if (!clean.chapterId && !clean.city)
          throw Error("Choose a chapter or destination.");
        if (currentChapter) clean.city = currentChapter.data.title;
        if (!clean.chapterId) {
          const inferred = chapterFor({ data: clean } as Row, chapters);
          if (inferred) clean.chapterId = inferred.id;
        }
      }
      if (clean.date && clean.endDate && clean.endDate < clean.date)
        throw Error("The last day must be after the first day.");
      if (activity && clean.endTime && clean.time && clean.endTime < clean.time)
        throw Error(
          "Finish time must follow start time. For overnight journeys, add a travel leg.",
        );
      if (
        destination &&
        clean.date &&
        clean.endDate &&
        new Date(clean.endDate).getTime() - new Date(clean.date).getTime() >
          365 * 86400000
      )
        throw Error(
          "Keep a chapter within one year. Split longer visits into chapters.",
        );
      if (
        stay &&
        clean.amount !== undefined &&
        (!Number.isFinite(clean.amount) || clean.amount < 0)
      )
        throw Error("Enter a valid total stay price.");
      if (
        file &&
        (![
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
          "text/plain",
        ].includes(file.type) ||
          file.size > 15 * 1024 * 1024)
      )
        throw Error("Use a PDF, photo, or text ticket smaller than 15 MB.");
      const latest = row
        ? getSnapshot().rows.find((r) => r.id === row.id) || row
        : undefined;
      const created: Row = latest
        ? {
            ...latest,
            data: clean,
            updatedAt: now(),
            by: settings.person || "konrad",
            dirty: true,
          }
        : newRow(
            kind,
            {
              ...clean,
              order: clean.order ?? rows.filter((r) => r.kind === kind).length,
            },
            settings.person || "konrad",
          );
      const changes = [created];
      const files: { id: string; blob: Blob }[] = [];
      if (file) {
        const doc = newRow(
          "document",
          {
            title: `Ticket · ${created.data.title}`,
            activityId: created.id,
            city: created.data.city,
            fileName: file.name,
            mime: file.type,
            size: file.size,
          },
          settings.person || "konrad",
        );
        changes.push(doc);
        files.push({ id: doc.id, blob: file });
      }
      if (stay && clean.activityId) {
        const item = getSnapshot().rows.find(
          (r) => r.id === clean.activityId && !r.deleted,
        );
        if (item)
          changes.push({
            ...item,
            data: {
              ...item.data,
              stayIds: [...new Set([...(item.data.stayIds || []), created.id])],
            },
            updatedAt: now(),
            by: settings.person || item.by,
            dirty: true,
          });
      }
      if (destination && row && row.data.title !== clean.title) {
        for (const item of getSnapshot().rows) {
          if (
            !item.deleted &&
            item.id !== row.id &&
            ["activity", "stay"].includes(item.kind) &&
            chapterFor(item, chapters)?.id === row.id
          )
            changes.push({
              ...item,
              data: { ...item.data, chapterId: row.id, city: clean.title },
              by: settings.person || item.by,
              updatedAt: now(),
              dirty: true,
            });
        }
      }
      await commitRows(changes, files);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this plan. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const chapterChoice = (
    <Field label="Which chapter?">
      <select
        value={data.chapterId || ""}
        onChange={(e) => {
          const chapter = chapters.find((c) => c.id === e.target.value);
          setData((d) => ({
            ...d,
            chapterId: e.target.value || undefined,
            city: chapter?.data.title || d.city,
          }));
        }}
      >
        <option value="">Choose a chapter / another destination</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.data.title}
            {c.data.date ? ` · ${c.data.date}` : ""}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <form className={`planning-form planning-form-${kind}`} onSubmit={submit}>
      <div className="form-story">
        <span className="form-story-icon">
          {destination ? (
            <MapPin />
          ) : travel ? (
            <ModeIcon />
          ) : stay ? (
            <BedDouble />
          ) : (
            <Sun />
          )}
        </span>
        <div>
          <strong>
            {destination
              ? "A new chapter in our story"
              : travel
                ? "The journey is part of the adventure"
                : stay
                  ? "Somewhere to call ours"
                  : "Let’s make a day of it"}
          </strong>
          <p>
            {destination
              ? "Pick a place. Give it a little time. The rest can follow."
              : travel
                ? "From one good place to the next. Keep the tickets right here."
                : stay
                  ? "Save a contender, or add the one we’ve already booked."
                  : "Just the essentials now. The little details can come later."}
          </p>
        </div>
      </div>
      {activity && (
        <fieldset className="activity-types">
          <legend>What kind of good time?</legend>
          {activityTypes.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              className={data.category === value ? "selected" : ""}
              aria-pressed={data.category === value}
              onClick={() => set("category", value)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </fieldset>
      )}
      {travel && (
        <fieldset className="travel-types">
          <legend>How are we getting there?</legend>
          {travelModes.map((value) => {
            const Icon = modeIcons[value];
            return (
              <button
                key={value}
                type="button"
                className={data.mode === value ? "selected" : ""}
                aria-pressed={data.mode === value}
                onClick={() => set("mode", value)}
              >
                <Icon size={21} />
                {value}
              </button>
            );
          })}
        </fieldset>
      )}
      {!travel && (
        <Field
          label={
            destination
              ? "Where are we heading?"
              : stay
                ? "What’s the place called?"
                : "What are we doing?"
          }
        >
          <input
            value={data.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={180}
            placeholder={
              destination
                ? "Cartagena, Salento, somewhere by the sea…"
                : stay
                  ? "The courtyard with the rooftop pool"
                  : data.category === "Food"
                    ? "Arepas, then another coffee"
                    : data.category === "Free time"
                      ? "An afternoon with absolutely no agenda"
                      : "A sunset walk through Getsemaní"
            }
          />
        </Field>
      )}
      {(activity || stay) && (
        <>
          {chapterChoice}
          {!data.chapterId && (
            <Field label="Destination">
              <input
                value={data.city || ""}
                onChange={(e) => set("city", e.target.value)}
                placeholder="e.g. Cartagena"
                required
              />
            </Field>
          )}
        </>
      )}
      {travel && (
        <>
          <div className="journey-fields">
            <Field label="Leaving from">
              <select
                value={data.fromChapterId || ""}
                required
                onChange={(e) => set("fromChapterId", e.target.value)}
              >
                <option value="">Choose departure chapter</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.data.title}
                  </option>
                ))}
              </select>
            </Field>
            <ArrowRight size={19} />
            <Field label="Heading to">
              <select
                value={data.toChapterId || ""}
                required
                onChange={(e) => set("toChapterId", e.target.value)}
              >
                <option value="">Choose arrival chapter</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.data.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="travel-times">
            <div>
              <h3>
                Take off <span>Colombia time</span>
              </h3>
              <Field label="Departure date">
                <input
                  type="date"
                  value={data.date || ""}
                  onChange={(e) => {
                    const date = e.target.value;
                    setData((d) => ({
                      ...d,
                      date,
                      arrivalDate: d.arrivalDate || date,
                    }));
                  }}
                />
              </Field>
              <Field label="Departure time">
                <input
                  type="time"
                  value={data.time || ""}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            </div>
            <div>
              <h3>
                Touch down <span>Colombia time</span>
              </h3>
              <Field label="Arrival date">
                <input
                  type="date"
                  value={data.arrivalDate || ""}
                  onChange={(e) => set("arrivalDate", e.target.value)}
                />
              </Field>
              <Field label="Arrival time">
                <input
                  type="time"
                  value={data.arrivalTime || ""}
                  onChange={(e) => set("arrivalTime", e.target.value)}
                />
              </Field>
            </div>
          </div>
          <Field label="Booking or ticket link">
            <input
              type="url"
              value={data.url || ""}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field
            label="Attach tickets now (optional)"
            hint="PDF or photo, up to 15 MB. You can also add tickets later."
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.txt"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </Field>
        </>
      )}
      {destination && (
        <div className="form-grid">
          <Field label="First day here">
            <input
              type="date"
              value={data.date || ""}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Last day here">
            <input
              type="date"
              value={data.endDate || ""}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
        </div>
      )}
      {activity && (
        <div className="activity-when">
          <div className="form-grid">
            <Field
              label="Which day?"
              hint="Leave blank if we haven’t decided yet."
            >
              <input
                type="date"
                value={data.date || ""}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Start time" hint="All times are local to Colombia.">
              <input
                type="time"
                value={data.time || ""}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
          </div>
          {currentChapter?.data.date &&
            data.date &&
            (data.date < currentChapter.data.date ||
              data.date >
                (currentChapter.data.endDate || currentChapter.data.date)) && (
              <p className="planning-hint">
                This day is outside the chapter dates. We’ll keep it visible in
                the chapter so you can adjust either.
              </p>
            )}
        </div>
      )}
      {stay && (
        <>
          <div className="form-grid">
            <Field label="Check-in">
              <input
                type="date"
                value={data.date || ""}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Check-out">
              <input
                type="date"
                value={data.endDate || ""}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Booking / Airbnb link">
            <input
              type="url"
              value={data.url || ""}
              onChange={(e) => set("url", e.target.value)}
              placeholder="Paste the listing you’ve been eyeing…"
            />
          </Field>
          <Field label="Where does this stay belong?">
            <select
              value={data.activityId || ""}
              onChange={(e) => set("activityId", e.target.value || undefined)}
            >
              <option value="">Keep in the shortlist for now</option>
              {rows
                .filter(
                  (r) => r.kind === "destination" || r.kind === "activity",
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.kind === "destination" ? "Whole chapter" : "Plan"} ·{" "}
                    {r.data.title}
                  </option>
                ))}
            </select>
          </Field>
          <div className="stay-status-picker">
            <span>How’s it looking?</span>
            {["Shortlisted", "Favorite", "Booked"].map((s) => (
              <button
                type="button"
                aria-pressed={data.status === s}
                key={s}
                className={data.status === s ? "selected" : ""}
                onClick={() => set("status", s)}
              >
                {s === "Shortlisted"
                  ? "A maybe"
                  : s === "Favorite"
                    ? "Love this one"
                    : "Booked ✓"}
              </button>
            ))}
          </div>
        </>
      )}
      {activity && (
        <fieldset className="form-stay-choice">
          <legend>
            Home base for this plan <span>optional</span>
          </legend>
          {rows.filter(
            (r) =>
              r.kind === "stay" &&
              (!data.city ||
                r.data.city === data.city ||
                (data.stayIds || []).includes(r.id)),
          ).length ? (
            <div className="stay-choice-list">
              {rows
                .filter(
                  (r) =>
                    r.kind === "stay" &&
                    (!data.city ||
                      r.data.city === data.city ||
                      (data.stayIds || []).includes(r.id)),
                )
                .map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      checked={data.stayIds?.includes(s.id) || false}
                      onChange={(e) =>
                        set(
                          "stayIds",
                          e.target.checked
                            ? [...(data.stayIds || []), s.id]
                            : (data.stayIds || []).filter((id) => id !== s.id),
                        )
                      }
                    />
                    <BedDouble size={17} />
                    <span>
                      <strong>{s.data.title}</strong>
                      <small>
                        {s.data.status === "Booked"
                          ? "Booked"
                          : "Shortlist option"}{" "}
                        · {s.data.city}
                      </small>
                    </span>
                  </label>
                ))}
            </div>
          ) : (
            <p>
              Save a stay in this destination, then link it here—or use “Link a
              stay” on the plan.
            </p>
          )}
        </fieldset>
      )}
      <details className="planning-details" open={undefined}>
        <summary>
          {travel
            ? "Stations, booking reference & notes"
            : stay
              ? "Price & the little details"
              : destination
                ? "A few words about this chapter"
                : "Booking, finish time & the little details"}
        </summary>
        <div>
          {travel && (
            <>
              <Field label="Journey name (optional)">
                <input
                  value={data.title}
                  maxLength={180}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Avianca AV123"
                />
              </Field>
              <div className="form-grid">
                <Field label="Airport / station leaving from">
                  <input
                    value={data.departurePlace || ""}
                    onChange={(e) => set("departurePlace", e.target.value)}
                    placeholder="BOG · El Dorado"
                  />
                </Field>
                <Field label="Airport / station arriving at">
                  <input
                    value={data.arrivalPlace || ""}
                    onChange={(e) => set("arrivalPlace", e.target.value)}
                    placeholder="CTG · Rafael Núñez"
                  />
                </Field>
              </div>
              <Field label="Booking reference">
                <input
                  value={data.bookingRef || ""}
                  onChange={(e) => set("bookingRef", e.target.value)}
                  placeholder="Keep the code close…"
                />
              </Field>
            </>
          )}
          {activity && (
            <>
              <div className="form-grid">
                <Field label="Finish time (optional)">
                  <input
                    type="time"
                    value={data.endTime || ""}
                    onChange={(e) => set("endTime", e.target.value)}
                  />
                </Field>
                <Field label="Plan status">
                  <select
                    value={data.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    {["Planned", "Booked", "Done"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Booking or useful link">
                <input
                  type="url"
                  value={data.url || ""}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </>
          )}
          {stay && (
            <div className="form-grid">
              <Field label="Total stay price (optional)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.amount ?? ""}
                  onChange={(e) =>
                    set(
                      "amount",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  inputMode="decimal"
                />
              </Field>
              <Field label="Currency">
                <select
                  value={data.currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {["EUR", "COP", "PLN", "USD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {travel && (
            <Field label="Journey status">
              <select
                value={data.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {["Planned", "Booked", "Done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Notes (optional)">
            <textarea
              value={data.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder={
                destination
                  ? "The feeling we’re chasing, places we can’t miss…"
                  : travel
                    ? "Baggage, transfers, meeting point…"
                    : "The little details worth keeping…"
              }
            />
          </Field>
        </div>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="form-actions">
        <p className="help">
          {destination
            ? "Dates can change. Good stories will follow."
            : travel
              ? "One less thing to search for at the station."
              : "A little planning goes a long way."}
        </p>
        <button className="button primary" disabled={saving} type="submit">
          {saving
            ? "Saving…"
            : row
              ? "Save changes"
              : destination
                ? "Add this chapter"
                : travel
                  ? "Save the journey"
                  : stay
                    ? "Save this stay"
                    : "Add to our day"}
          <Check size={17} />
        </button>
      </footer>
    </form>
  );
}

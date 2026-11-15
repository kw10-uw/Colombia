import { useState, useCallback, type ReactNode } from "react";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  MapPin,
  BedDouble,
  CalendarDays,
  Paperclip,
  Check,
  Pencil,
  Trash2,
  MoreHorizontal,
  Sun,
  Utensils,
  Camera,
  Coffee,
  Route,
  Ticket,
  Link as LinkIcon,
} from "lucide-react";
import { type Row, type Data, type Settings, formatDate, now } from "./model";
import {
  orderedChapters,
  chapterFor,
  chapterDays,
  linkedStays,
  sortActivities,
  colombiaDate,
  tripIsToday,
  todaySchedule,
} from "./planning";
import { modeIcons } from "./PlanningForm";
import { type Editor } from "./forms";
import { Byline, External, Empty, Modal } from "./components";
import { editRow, commitRows, getSnapshot } from "./store";

type Props = {
  rows: Row[];
  settings: Settings;
  onEdit: (kind: Editor["kind"], row?: Row, preset?: Partial<Data>) => void;
  onDelete: (row: Row) => void;
  docsFor: (row: Row) => ReactNode;
  onDoc: (row: Row) => void;
  notify: (s: string) => void;
  initialChapter?: string;
  onChapterChange: (id: string) => void;
};
export default function PlanPage({
  rows,
  settings,
  onEdit,
  onDelete,
  docsFor,
  onDoc,
  notify,
  initialChapter,
  onChapterChange,
}: Props) {
  const chapters = orderedChapters(rows);
  const [selected, setSelected] = useState(initialChapter || "all");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [stayTarget, setStayTarget] = useState<Row>();
  const closeStay = useCallback(() => setStayTarget(undefined), []);
  const choose = (id: string) => {
    setSelected(id);
    onChapterChange(id);
  };
  const chapterList =
    selected === "all" ? chapters : chapters.filter((c) => c.id === selected);
  const actualSelected = chapters.some((c) => c.id === selected)
    ? selected
    : "all";
  const visibleChapters = actualSelected === "all" ? chapters : chapterList;
  const activities = rows.filter((r) => r.kind === "activity");
  const journeys = rows.filter((r) => r.kind === "travel");
  const unassigned = activities.filter((r) => !chapterFor(r, chapters));
  async function run(task: () => Promise<unknown>) {
    try {
      await task();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update the plan.");
    }
  }
  function addActivity(chapter?: Row, date?: string) {
    onEdit("activity", undefined, {
      chapterId: chapter?.id,
      city: chapter?.data.title,
      date,
    });
  }
  function itemMenu(row: Row) {
    return (
      <details className="plan-item-menu">
        <summary aria-label={`More options for ${row.data.title}`}>
          <MoreHorizontal size={18} />
        </summary>
        <div>
          <button onClick={() => onEdit(row.kind, row)}>
            <Pencil size={15} />
            Edit{" "}
            {row.kind === "destination"
              ? "chapter"
              : row.kind === "travel"
                ? "journey"
                : "plan"}
          </button>
          <button onClick={() => setStayTarget(row)}>
            <BedDouble size={15} />
            Link a stay
          </button>
          <button onClick={() => onDoc(row)}>
            <Paperclip size={15} />
            {row.kind === "travel" ? "Add tickets" : "Attach document"}
          </button>
          <button onClick={() => onDelete(row)}>
            <Trash2 size={15} />
            Remove
          </button>
        </div>
      </details>
    );
  }
  function staysFor(item: Row) {
    const stays = linkedStays(item, rows);
    return stays.length ? (
      <div className="plan-linked-stays">
        {stays.map((stay) => (
          <div className="plan-stay" key={stay.id}>
            <BedDouble size={18} />
            <div>
              <strong>{stay.data.title}</strong>
              <span>
                {stay.data.status === "Booked" ? "Booked" : "Shortlisted"}
                {stay.data.date
                  ? ` · ${formatDate(stay.data.date)} – ${formatDate(stay.data.endDate)}`
                  : ""}
              </span>
            </div>
            <External url={stay.data.url}>Listing</External>
            <button
              className="icon-button"
              aria-label={`Edit stay ${stay.data.title}`}
              onClick={() => onEdit("stay", stay)}
            >
              <Pencil size={14} />
            </button>
            {docsFor(stay)}
          </div>
        ))}
      </div>
    ) : null;
  }
  function activityItem(row: Row) {
    const Icon =
      row.data.category === "Food"
        ? Utensils
        : row.data.category === "Free time"
          ? Coffee
          : row.data.category === "Transport"
            ? Route
            : Camera;
    return (
      <article
        className={`plan-item chapter-activity ${row.data.status === "Done" ? "is-done" : ""}`}
        key={row.id}
      >
        <div className="chapter-activity-time">
          <strong>{row.data.time || "Any time"}</strong>
          {row.data.endTime && <span>until {row.data.endTime}</span>}
          <Icon size={17} />
        </div>
        <div className="chapter-activity-body">
          <div className="row">
            <h4>{row.data.title}</h4>
            <span
              className={`pill ${row.data.status === "Booked" ? "sage" : ""}`}
            >
              {row.data.status || "Planned"}
            </span>
          </div>
          {docsFor(row)}
          {staysFor(row)}
          <details className="activity-details">
            <summary>
              Details & notes
              <ChevronDown size={13} />
            </summary>
            <div>
              {row.data.notes ? (
                <p className="item-notes">{row.data.notes}</p>
              ) : (
                <p className="help">A little room for the details.</p>
              )}
              <External url={row.data.url}>Booking & details</External>
              <Byline person={row.by} />
            </div>
          </details>
          <div className="activity-shortcuts">
            <button
              aria-label={`Edit ${row.data.title}`}
              onClick={() => onEdit("activity", row)}
            >
              <Pencil size={13} />
              Edit
            </button>
            <button onClick={() => setStayTarget(row)}>
              <BedDouble size={14} />
              {linkedStays(row, rows).length ? "Manage stays" : "Link a stay"}
            </button>
            <button onClick={() => onDoc(row)}>
              <Paperclip size={13} />
              Add ticket
            </button>
          </div>
        </div>
        <div className="chapter-activity-actions">
          <button
            className={`icon-button ${row.data.status === "Done" ? "done" : ""}`}
            aria-label={`Mark ${row.data.title} as ${row.data.status === "Done" ? "planned" : "done"}`}
            onClick={() =>
              run(() =>
                editRow(row, {
                  status: row.data.status === "Done" ? "Planned" : "Done",
                }),
              )
            }
          >
            <Check size={17} />
          </button>
          {itemMenu(row)}
        </div>
      </article>
    );
  }
  function journey(row: Row) {
    const mode = (row.data.mode || "Other") as keyof typeof modeIcons;
    const Icon = modeIcons[mode] || Route;
    const from = chapters.find((c) => c.id === row.data.fromChapterId),
      to = chapters.find((c) => c.id === row.data.toChapterId);
    return (
      <article key={row.id} className="journey-card">
        <div className="journey-rail">
          <span>
            <Icon size={23} />
          </span>
        </div>
        <div className="journey-body">
          <div className="row">
            <span className="eyebrow">
              THE WAY THERE · {row.data.mode || "JOURNEY"}
            </span>
            {itemMenu(row)}
          </div>
          <h3>
            {from?.data.title || row.data.city || "Departure"}
            <ArrowRight size={19} />
            {to?.data.title || "Arrival chapter removed"}
          </h3>
          <p className="journey-name">{row.data.title}</p>
          <div className="journey-schedule">
            <div>
              <strong>{row.data.time || "Time to decide"}</strong>
              <span>{formatDate(row.data.date)}</span>
              {row.data.departurePlace && (
                <small>{row.data.departurePlace}</small>
              )}
            </div>
            <ArrowRight size={20} />
            <div>
              <strong>{row.data.arrivalTime || "Time to decide"}</strong>
              <span>{formatDate(row.data.arrivalDate || row.data.date)}</span>
              {row.data.arrivalPlace && <small>{row.data.arrivalPlace}</small>}
            </div>
            <span
              className={`pill ${row.data.status === "Booked" ? "sage" : ""}`}
            >
              {row.data.status || "Planned"}
            </span>
          </div>
          {docsFor(row)}
          {row.data.bookingRef && (
            <p className="booking-ref">
              Booking reference <strong>{row.data.bookingRef}</strong>
            </p>
          )}
          <div className="activity-shortcuts">
            <button onClick={() => onEdit("travel", row)}>
              <Pencil size={14} />
              Edit journey
            </button>
            <button onClick={() => onDoc(row)}>
              <Ticket size={14} />
              Add tickets
            </button>
            <button
              onClick={() =>
                onEdit("travel", undefined, {
                  fromChapterId: row.data.fromChapterId,
                  toChapterId: row.data.toChapterId,
                  date: row.data.date,
                  arrivalDate: row.data.arrivalDate,
                })
              }
            >
              <Plus size={14} />
              Compare another way
            </button>
            <External url={row.data.url}>Booking / ticket</External>
          </div>
          {row.data.notes && (
            <details className="activity-details">
              <summary>
                Journey notes
                <ChevronDown size={13} />
              </summary>
              <p className="item-notes">{row.data.notes}</p>
            </details>
          )}
        </div>
      </article>
    );
  }
  function daySection(
    chapter: Row,
    date: string,
    dayItems: Row[],
    index: number,
  ) {
    const outside = !!(
      date &&
      chapter.data.date &&
      (date < chapter.data.date ||
        date > (chapter.data.endDate || chapter.data.date))
    );
    return (
      <section className="chapter-day" key={date || "flexible"}>
        <div className="chapter-day-heading">
          <div className="day-number">
            {date ? String(index + 1).padStart(2, "0") : "↗"}
          </div>
          <div>
            <h3>
              {date
                ? new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(date + "T12:00:00"))
                : "Still flexible"}
            </h3>
            <p>
              {outside
                ? "Outside chapter dates · adjust the day or chapter"
                : date === colombiaDate()
                  ? "Today in Colombia"
                  : date
                    ? `${dayItems.length} ${dayItems.length === 1 ? "plan" : "plans"} · time for a little spontaneity`
                    : "Good ideas, waiting for their day"}
            </p>
          </div>
          <button
            className="button subtle"
            aria-label={`Add a plan in ${chapter.data.title}${date ? ` on ${date}` : ""}`}
            onClick={() => addActivity(chapter, date || undefined)}
          >
            <Plus size={15} />
            <span>Add a plan</span>
          </button>
        </div>
        {dayItems.map(activityItem)}
        {!dayItems.length && (
          <button
            className="empty-day"
            onClick={() => addActivity(chapter, date)}
          >
            <Sun size={19} />
            <span>A beautiful blank page. What shall we do?</span>
            <Plus size={15} />
          </button>
        )}
      </section>
    );
  }
  return (
    <div className="plan-workspace">
      <div className="plan-topline">
        <div>
          <span className="eyebrow">THE STORY SO FAR</span>
          <p>
            {chapters.length} chapters <span>·</span> {activities.length} plans{" "}
            <span>·</span> {journeys.length} journeys
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onEdit("destination")}
        >
          <Plus size={17} />
          Add a chapter
        </button>
      </div>
      <nav className="chapter-nav" aria-label="Chapters of the trip">
        <button
          aria-pressed={actualSelected === "all"}
          className={actualSelected === "all" ? "selected" : ""}
          onClick={() => choose("all")}
        >
          <Route size={17} />
          Whole route
        </button>
        {chapters.map((c, i) => (
          <button
            key={c.id}
            aria-label={`Open ${c.data.title} chapter`}
            aria-pressed={actualSelected === c.id}
            className={actualSelected === c.id ? "selected" : ""}
            onClick={() => choose(c.id)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {c.data.title}
          </button>
        ))}
      </nav>
      {!chapters.length && (
        <Empty
          icon={<MapPin />}
          title="Every story starts somewhere"
          action={() => onEdit("destination")}
          label="Add our first chapter"
        >
          Choose a destination, then build its days, home base, and the journey
          onwards.
        </Empty>
      )}
      {visibleChapters.map((chapter) => {
        const index = chapters.indexOf(chapter),
          next = chapters[index + 1];
        const items = activities
          .filter((r) => chapterFor(r, chapters)?.id === chapter.id)
          .sort(sortActivities);
        const days = chapterDays(chapter, items);
        const flexible = items.filter((r) => !r.data.date);
        const isCollapsed = collapsed.includes(chapter.id);
        const base = linkedStays(chapter, rows);
        return (
          <div className="chapter-and-journey" key={chapter.id}>
            {actualSelected !== "all" &&
              journeys
                .filter(
                  (r) =>
                    r.data.toChapterId === chapter.id &&
                    r.data.fromChapterId !== chapter.id,
                )
                .map(journey)}
            <section
              className={`itinerary-chapter chapter-tone-${index % 3}`}
              aria-label={`${chapter.data.title} chapter`}
            >
              <header className="chapter-heading">
                <button
                  className="chapter-heading-main"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((current) =>
                      isCollapsed
                        ? current.filter((id) => id !== chapter.id)
                        : [...current, chapter.id],
                    )
                  }
                >
                  <span className="chapter-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="eyebrow">A LITTLE CHAPTER OF OURS</span>
                    <h2>{chapter.data.title}</h2>
                    <p>
                      {chapter.data.date
                        ? `${formatDate(chapter.data.date)} – ${formatDate(chapter.data.endDate || chapter.data.date)}`
                        : "Dates still flexible"}
                      <span>·</span>
                      {days.length} days<span>·</span>
                      {items.length} plans
                    </p>
                  </div>
                  {isCollapsed ? (
                    <ChevronRight size={22} />
                  ) : (
                    <ChevronDown size={22} />
                  )}
                </button>
                <div className="chapter-controls">
                  <button
                    className="icon-button"
                    aria-label={`Move ${chapter.data.title} earlier`}
                    disabled={index === 0}
                    onClick={() =>
                      run(() =>
                        commitRows([
                          {
                            ...chapter,
                            data: { ...chapter.data, order: index - 1 },
                            dirty: true,
                            updatedAt: now(),
                          },
                          {
                            ...chapters[index - 1],
                            data: { ...chapters[index - 1].data, order: index },
                            dirty: true,
                            updatedAt: now(),
                          },
                        ]),
                      )
                    }
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Move ${chapter.data.title} later`}
                    disabled={!next}
                    onClick={() =>
                      run(() =>
                        commitRows([
                          {
                            ...chapter,
                            data: { ...chapter.data, order: index + 1 },
                            dirty: true,
                            updatedAt: now(),
                          },
                          {
                            ...next,
                            data: { ...next.data, order: index },
                            dirty: true,
                            updatedAt: now(),
                          },
                        ]),
                      )
                    }
                  >
                    <ArrowRight size={15} />
                  </button>
                  {itemMenu(chapter)}
                </div>
              </header>
              {!isCollapsed && (
                <div className="chapter-content">
                  <div className="chapter-at-a-glance">
                    <div>
                      <BedDouble size={20} />
                      <strong>Our home base</strong>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setStayTarget(chapter)}
                    >
                      {base.length ? "Manage stays" : "Link a stay"}
                      <Plus size={14} />
                    </button>
                  </div>
                  {staysFor(chapter)}
                  {!base.length && (
                    <p className="base-empty">
                      A hotel, an Airbnb, a few contenders—keep them with this
                      chapter.
                    </p>
                  )}
                  {chapter.data.notes && (
                    <details className="chapter-notes">
                      <summary>
                        About this chapter
                        <ChevronDown size={13} />
                      </summary>
                      <p>{chapter.data.notes}</p>
                    </details>
                  )}
                  <div className="chapter-days">
                    {days.map((date, i) =>
                      daySection(
                        chapter,
                        date,
                        items.filter((r) => r.data.date === date),
                        i,
                      ),
                    )}
                    {flexible.length > 0 &&
                      daySection(chapter, "", flexible, days.length)}
                    {!days.length && !flexible.length && (
                      <div className="chapter-first-day">
                        <CalendarDays size={27} />
                        <h3>A chapter full of possibilities</h3>
                        <p>
                          Add dates to see every day here, or start with a plan
                          and decide the dates later.
                        </p>
                        <div>
                          <button
                            className="button primary"
                            onClick={() => addActivity(chapter)}
                          >
                            <Plus size={16} />
                            Add the first plan
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => onEdit("destination", chapter)}
                          >
                            Set chapter dates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
            {journeys
              .filter((r) => r.data.fromChapterId === chapter.id)
              .map(journey)}
            {next &&
              !journeys.some(
                (r) =>
                  r.data.fromChapterId === chapter.id &&
                  r.data.toChapterId === next.id,
              ) && (
                <button
                  className="add-journey"
                  onClick={() =>
                    onEdit("travel", undefined, {
                      fromChapterId: chapter.id,
                      toChapterId: next.id,
                      date: chapter.data.endDate || next.data.date,
                      arrivalDate: next.data.date || chapter.data.endDate,
                    })
                  }
                >
                  <span>
                    <Route size={20} />
                  </span>
                  <div>
                    <strong>How are we getting to {next.data.title}?</strong>
                    <p>
                      Plane, bus, train, or a little road trip. Add the journey
                      and its tickets.
                    </p>
                  </div>
                  <Plus size={19} />
                </button>
              )}
          </div>
        );
      })}
      {actualSelected === "all" && unassigned.length > 0 && (
        <section className="unassigned-plans">
          <h2>Plans waiting for a chapter</h2>
          <p>
            These existing plans are safe here. Edit one to place it in the
            right chapter.
          </p>
          {unassigned.sort(sortActivities).map(activityItem)}
        </section>
      )}
      {journeys.filter(
        (r) => !chapters.some((c) => c.id === r.data.fromChapterId),
      ).length > 0 && (
        <section className="unassigned-plans">
          <h2>Journeys to reconnect</h2>
          <p>
            A chapter was removed. Update these journeys to connect the route
            again.
          </p>
          {journeys
            .filter((r) => !chapters.some((c) => c.id === r.data.fromChapterId))
            .map(journey)}
        </section>
      )}
      {stayTarget && (
        <StayPicker
          target={stayTarget}
          rows={rows}
          onClose={closeStay}
          onNew={() => {
            onEdit("stay", undefined, {
              chapterId:
                stayTarget.kind === "destination"
                  ? stayTarget.id
                  : chapterFor(stayTarget, chapters)?.id,
              city:
                stayTarget.kind === "destination"
                  ? stayTarget.data.title
                  : stayTarget.data.city,
              activityId: stayTarget.id,
            });
            closeStay();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function StayPicker({
  target,
  rows,
  onClose,
  onNew,
  notify,
}: {
  target: Row;
  rows: Row[];
  onClose: () => void;
  onNew: () => void;
  notify: (s: string) => void;
}) {
  const [selected, setSelected] = useState(
    linkedStays(target, rows).map((r) => r.id),
  );
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const city =
    target.kind === "destination" ? target.data.title : target.data.city;
  const stays = rows.filter(
    (r) =>
      r.kind === "stay" &&
      (all || !city || r.data.city === city || selected.includes(r.id)),
  );
  return (
    <Modal title="Somewhere to call home" onClose={onClose}>
      <div className="stay-picker-intro">
        <BedDouble size={25} />
        <p>
          Link stays to <strong>{target.data.title}</strong>. Keep a shortlist,
          or just the one we’ve booked.
        </p>
      </div>
      <div className="stay-choice-list stay-picker-list">
        {stays.map((stay) => (
          <label key={stay.id}>
            <input
              type="checkbox"
              checked={selected.includes(stay.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, stay.id]
                    : ids.filter((id) => id !== stay.id),
                )
              }
            />
            <BedDouble size={20} />
            <span>
              <strong>{stay.data.title}</strong>
              <small>
                {stay.data.city || "Destination to decide"} ·{" "}
                {stay.data.status === "Booked" ? "Booked" : "Shortlist option"}
              </small>
            </span>
          </label>
        ))}
      </div>
      {!stays.length && (
        <p className="help">
          No stays saved for this chapter yet. Add one below, or look at the
          whole shortlist.
        </p>
      )}
      <div className="row stay-picker-tools">
        <button className="text-link" onClick={() => setAll((v) => !v)}>
          {all ? "Just this destination" : "Show all saved stays"}
        </button>
        <button className="button secondary" onClick={onNew}>
          <Plus size={16} />
          Add a new stay
        </button>
      </div>
      <div className="form-actions">
        <span className="help">
          {selected.length} {selected.length === 1 ? "stay" : "stays"} linked to
          this plan
        </span>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const person = getSnapshot().settings.person || "konrad";
              const latest =
                getSnapshot().rows.find((r) => r.id === target.id) || target;
              const changes: Row[] = [
                {
                  ...latest,
                  data: { ...latest.data, stayIds: selected },
                  by: person,
                  dirty: true,
                  updatedAt: now(),
                },
              ];
              for (const stay of rows.filter(
                (r) =>
                  r.kind === "stay" &&
                  r.data.activityId === target.id &&
                  !selected.includes(r.id),
              ))
                changes.push({
                  ...stay,
                  data: { ...stay.data, activityId: undefined },
                  by: person,
                  dirty: true,
                  updatedAt: now(),
                });
              await commitRows(changes);
              onClose();
              notify("Stays linked. Home base, sorted.");
            } catch {
              notify("Could not link stays. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save linked stays
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}

export function TodayPlan({
  rows,
  settings,
  today,
  onOpen,
  onDoc,
  docsFor,
}: {
  rows: Row[];
  settings: Settings;
  today: string;
  onOpen: () => void;
  onDoc: (r: Row) => void;
  docsFor: (r: Row) => ReactNode;
}) {
  if (!tripIsToday(rows, settings, today)) return null;
  const items = todaySchedule(rows, today);
  const chapters = orderedChapters(rows);
  const chapter =
    chapters.find(
      (c) =>
        c.data.date &&
        c.data.endDate &&
        today >= c.data.date &&
        today <= c.data.endDate,
    ) || chapterFor(items[0] || ({ data: {} } as Row), chapters);
  const bases = rows.filter(
    (r) =>
      r.kind === "stay" &&
      r.data.status === "Booked" &&
      r.data.date &&
      today >= r.data.date &&
      (!r.data.endDate || today <= r.data.endDate),
  );
  return (
    <section className="today-plan" aria-label="Today's plan">
      <header>
        <div>
          <span className="eyebrow">
            <Sun size={14} />
            TODAY IN COLOMBIA
          </span>
          <h2>
            {chapter
              ? `A day in ${chapter.data.title}`
              : "Another day, another good story."}
          </h2>
          <p>
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date(today + "T12:00:00"))}{" "}
            · Colombia time
          </p>
        </div>
        <button className="button ink" onClick={onOpen}>
          Open the plan
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="today-items">
        {items.map((row) => {
          const arrival = row.kind === "travel" && row.data.date !== today;
          return (
            <div className="today-item" key={row.id}>
              <span className="today-time">
                {(arrival ? row.data.arrivalTime : row.data.time) || "Any time"}
              </span>
              <div>
                <h3>
                  {arrival ? "Arrive · " : ""}
                  {row.data.title}
                </h3>
                <p>
                  {row.kind === "travel"
                    ? `${row.data.mode} · ${row.data.status || "Planned"}`
                    : row.data.category}
                  {row.data.status === "Done" ? " · Done" : ""}
                </p>
                {docsFor(row)}
                {linkedStays(row, rows).map((s) => (
                  <External key={s.id} url={s.data.url}>
                    <BedDouble size={13} />
                    {s.data.title}
                  </External>
                ))}
              </div>
              <button
                className="icon-button"
                aria-label={`Tickets for ${row.data.title}`}
                onClick={() => onDoc(row)}
              >
                <Ticket size={18} />
              </button>
            </div>
          );
        })}
        {!items.length && (
          <div className="today-free">
            <Coffee size={23} />
            <p>
              A little breathing room. There’s nothing scheduled for today yet.
            </p>
            <button className="text-link" onClick={onOpen}>
              Make a little plan
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
      {bases.length > 0 && (
        <div className="today-bases">
          {bases.map((s) => (
            <div key={s.id}>
              <BedDouble size={17} />
              <span>
                {s.data.endDate === today
                  ? "Checking out today"
                  : s.data.date === today
                    ? "Checking in today"
                    : "Tonight’s home base"}
                <strong>{s.data.title}</strong>
              </span>
              <External url={s.data.url}>Booking</External>
              {docsFor(s)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

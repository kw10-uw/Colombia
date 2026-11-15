import {
  useState,
  useEffect,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import {
  Users,
  CalendarDays,
  BedDouble,
  Compass,
  FolderOpen,
  Wallet,
  Settings as SettingsIcon,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MapPin,
  Sun,
  Sparkles,
  Heart,
  MoreHorizontal,
  Plane,
  Coffee,
  Check,
  Pencil,
  Trash2,
  Paperclip,
  Download,
  Search,
  RefreshCw,
  WifiOff,
  Cloud,
  ChevronRight,
  X,
  Copy,
  Link,
  CheckCircle2,
  Route,
  Utensils,
  FileText,
  Upload,
  Mountain,
  Palmtree,
  Banknote,
  Menu,
  CircleHelp,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  people,
  defaults,
  formatDate,
  localDate,
  money,
  balances,
  transfers,
  toCents,
  rateFor,
  validUrl,
  type Row,
  type Data,
  type Kind,
  type Person,
  type Settings,
  type Currency,
} from "./model";
import {
  initialize,
  subscribe,
  getSnapshot,
  saveSettings,
  startTrip,
  editRow,
  deleteRow,
  addRow,
  getFile,
  storageEstimate,
} from "./store";
import {
  syncTrip,
  syncSubscribe,
  syncSnapshot,
  connectTrip,
  disconnectTrip,
  inviteLink,
  resolveConflict,
  downloadDocument,
  cacheAllDocuments,
} from "./cloud";
import { exportBackup, importBackup, download } from "./backup";
import { discoveries } from "./seeds";
import { Avatar, Byline, Modal, Field, External, Empty } from "./components";
import { EntityForm, type Editor } from "./forms";

type Page =
  "crew" | "plan" | "stays" | "discover" | "documents" | "money" | "settings";
const nav: [Page, string, typeof Users][] = [
  ["crew", "The crew", Users],
  ["plan", "Itinerary", CalendarDays],
  ["stays", "Stays", BedDouble],
  ["discover", "Discover", Compass],
  ["documents", "Documents", FolderOpen],
  ["money", "Expenses", Wallet],
];
const titles: Record<Page, string> = {
  crew: "The crew",
  plan: "Our itinerary",
  stays: "Stay a little",
  discover: "Follow your curiosity",
  documents: "Your trip pocket",
  money: "The good kind of split",
  settings: "Make it yours",
};
const greeting = () =>
  new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
function errorMessage(e: unknown) {
  return e instanceof Error
    ? e.message
    : (e as { message?: string })?.message ||
        "Something went wrong. Please try again.";
}
function sortPlan(a: Row, b: Row) {
  return (
    (a.data.date || "9999").localeCompare(b.data.date || "9999") ||
    (a.data.time || "99").localeCompare(b.data.time || "99") ||
    (a.data.order || 0) - (b.data.order || 0)
  );
}

export default function App() {
  const {
    rows: allRows,
    settings,
    ready,
    error,
  } = useSyncExternalStore(subscribe, getSnapshot);
  const sync = useSyncExternalStore(syncSubscribe, syncSnapshot);
  const [page, setPage] = useState<Page>("crew");
  const [city, setCity] = useState("All destinations");
  const [editor, setEditor] = useState<Editor>();
  const [profile, setProfile] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [confirmDelete, setConfirmDelete] = useState<Row>();
  const [joinConfig, setJoinConfig] = useState<{
    url: string;
    key: string;
    invite: string;
  }>();
  const [installPrompt, setInstallPrompt] = useState<any>();
  const [installHelp, setInstallHelp] = useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW() {},
    onRegisterError(e) {
      console.warn("Offline setup unavailable", e);
    },
  });
  const rows = allRows.filter((r) => !r.deleted);
  const stops = rows
    .filter((r) => r.kind === "destination")
    .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
  const filtered = rows.filter(
    (r) =>
      city === "All destinations" ||
      (r.kind === "destination" && r.data.title === city) ||
      r.data.city === city,
  );
  const person = settings.person || "konrad";
  const notify = useCallback((message: string) => setToast(message), []);
  const go = useCallback((next: Page) => {
    setPage(next);
    setMobileMore(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const closeEditor = useCallback(() => setEditor(undefined), []);
  const closeProfile = useCallback(() => setProfile(false), []);
  const closeDelete = useCallback(() => setConfirmDelete(undefined), []);
  function edit(kind: Kind, row?: Row, preset?: Partial<Data>) {
    setEditor({
      kind,
      row,
      preset: { city: city === "All destinations" ? "" : city, ...preset },
    });
  }
  const run = useCallback(
    async (task: () => Promise<unknown>, success?: string) => {
      try {
        await task();
        if (success) notify(success);
      } catch (e) {
        notify(errorMessage(e));
      }
    },
    [notify],
  );
  useEffect(() => {
    initialize();
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncTrip();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", install);
    const hash = location.hash;
    if (hash.startsWith("#join=")) {
      try {
        const c = JSON.parse(atob(hash.slice(6)));
        if (
          typeof c.url === "string" &&
          typeof c.key === "string" &&
          /^[a-f0-9]{64}$/.test(c.invite)
        ) {
          setJoinConfig(c);
          setPage("settings");
        }
      } catch {
        notify("This trip invite could not be read. Ask for a fresh link.");
      }
      history.replaceState(null, "", location.pathname + location.search);
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, [notify]);
  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => void syncTrip(), 1800);
    return () => clearTimeout(timeout);
  }, [ready, allRows]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void syncTrip();
    }, 20000);
    const visible = () => {
      if (document.visibilityState === "visible") void syncTrip();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timeout);
  }, [toast]);
  async function openDoc(row: Row) {
    try {
      const blob = await downloadDocument(row);
      download(blob, row.data.fileName || row.data.title);
      notify("Document downloaded and kept on this phone.");
    } catch (e) {
      notify(errorMessage(e));
    }
  }
  async function toggleVote(row: Row) {
    await run(() =>
      editRow(row, {
        votes: row.data.votes?.includes(person)
          ? row.data.votes.filter((p) => p !== person)
          : [...(row.data.votes || []), person],
      }),
    );
  }
  const actions = (row: Row, extra?: ReactNode) => (
    <div className="item-actions">
      {extra}
      {row.kind !== "settlement" && <button
        className="icon-button"
        aria-label={`Edit ${row.data.title}`}
        onClick={() => edit(row.kind, row)}
      >
        <Pencil size={16} />
      </button>}
      <button
        className="icon-button"
        aria-label={`Delete ${row.data.title}`}
        onClick={() => setConfirmDelete(row)}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  const attached = (row: Row) =>
    rows.filter((r) => r.kind === "document" && r.data.activityId === row.id);
  const docsFor = (row: Row) => (
    <div className="attachment-links">
      {attached(row).map((doc) => (
        <button
          key={doc.id}
          className="attachment"
          onClick={() => openDoc(doc)}
        >
          <Paperclip size={13} />
          {doc.data.title}
        </button>
      ))}
    </div>
  );
  const addButton = (kind: Kind, label: string) => (
    <button className="button primary" onClick={() => edit(kind)}>
      <Plus size={17} />
      {label}
    </button>
  );

  if (!ready)
    return (
      <div className="loading">
        <Sun size={40} />
        <strong>Getting the crew together…</strong>
      </div>
    );
  if (error)
    return (
      <div className="fatal">
        <h1>A little storage trouble.</h1>
        <p role="alert">{error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("crew");
          }}
        >
          turbo<span>colombia</span>
          <Sparkles size={20} />
        </a>
        <p className="sidebar-caption">THE EL PARCHE EDITION</p>
        <div className="trip-label">
          <span className="tiny-sun">✳</span>
          <div>
            <strong>Colombia, here we come</strong>
            <span>
              {settings.startDate
                ? `${formatDate(settings.startDate)} – ${formatDate(settings.endDate)}`
                : "Four friends. One adventure."}
            </span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => go(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
              {id === "documents" &&
                rows.some((r) => r.kind === "document") && (
                  <span className="nav-count">
                    {rows.filter((r) => r.kind === "document").length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="crew-mini">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfile(true)}
                aria-label={`Traveler ${p.name}`}
              >
                <Avatar person={p.id} size={39} />
              </button>
            ))}
            <span>El mejor parche.</span>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <SettingsIcon size={19} />
            Trip settings
          </button>
          <button
            className="nav-item"
            onClick={() =>
              installPrompt
                ? run(async () => {
                    await installPrompt.prompt();
                    setInstallPrompt(undefined);
                  })
                : setInstallHelp(true)
            }
          >
            <Download size={19} />
            Add to home screen
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Our adventure</span>
            <ChevronRight size={14} />
            <strong>{titles[page]}</strong>
          </div>
          <a
            className="mobile-wordmark"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("crew");
            }}
          >
            turbo<span>colombia</span> ✳
          </a>
          <div className="topbar-right">
            <button
              className={`sync-status ${sync.phase === "error" ? "sync-error" : ""}`}
              title={sync.message}
              onClick={() =>
                settings.cloud ? void syncTrip() : go("settings")
              }
            >
              {!online ? (
                <WifiOff size={14} />
              ) : sync.phase === "syncing" ? (
                <RefreshCw size={14} className="spin" />
              ) : settings.cloud ? (
                <Cloud size={14} />
              ) : (
                <span className="status-dot" />
              )}
              <span>
                {!online
                  ? "Offline"
                  : sync.phase === "syncing"
                    ? "Syncing"
                    : sync.phase === "error"
                      ? "Check sync"
                      : settings.cloud
                        ? "Crew connected"
                        : "On this phone"}
              </span>
            </button>
            <button
              className="profile-button"
              onClick={() => setProfile(true)}
              aria-label={`Your profile: ${people.find((p) => p.id === person)?.name}. Change traveler.`}
            >
              <Avatar person={person} size={40} />
            </button>
          </div>
        </header>
        {!online && (
          <div className="connection-banner">
            <WifiOff size={15} />
            You’re offline. Keep planning—changes stay on this phone until you
            reconnect.
          </div>
        )}
        {needRefresh && (
          <div className="connection-banner">
            A fresh version is ready.
            <button onClick={() => void updateServiceWorker(true)}>
              Update app
            </button>
          </div>
        )}
        <main className="content" id="main-content">
          {page === "crew" && (
            <>
              <div className="page-intro">
                <div>
                  <p className="eyebrow">FOUR FRIENDS. ONE VERY GOOD IDEA.</p>
                  <h1>
                    ¡Vamos, <span className="underlined">parche!</span>
                    <span className="title-spark">✳</span>
                  </h1>
                  <p className="intro-copy">
                    A little planning. A lot of Colombia. All of us together.
                  </p>
                </div>
                <span className="colombia-clock">
                  <Sun size={19} />
                  Colombia time <strong>{greeting()}</strong>
                </span>
              </div>
              <div className="dashboard-grid">
                <section className="welcome-card">
                  <div className="welcome-copy">
                    <span className="eyebrow">NEXT CHAPTER: THE ADVENTURE</span>
                    <h2>
                      Good company.
                      <br />
                      Great stories
                      <br />
                      <em>incoming.</em>
                    </h2>
                    <p>
                      {settings.startDate
                        ? `The adventure starts ${formatDate(settings.startDate)}. Let’s make it ours.`
                        : "Set the route, collect the good stuff, and leave a little room for magic."}
                    </p>
                    <button className="button ink" onClick={() => go("plan")}>
                      Let’s plan this
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="sun-art" aria-hidden="true">
                    <div className="sun-orbit"></div>
                    <div className="sun-face">
                      <span></span>
                      <span></span>
                      <b>⌣</b>
                    </div>
                    <span className="art-star star-one">✳</span>
                    <span className="art-star star-two">✦</span>
                    <div className="hill hill-back"></div>
                    <div className="hill hill-front"></div>
                    <div className="little-house">
                      <span></span>
                    </div>
                    <div className="palm-leaf"></div>
                  </div>
                  <div className="welcome-footer">
                    <span>COLOMBIA CON EL PARCHE</span>
                    <span>4 FRIENDS / ∞ POSSIBILITIES</span>
                  </div>
                </section>
                <section className="crew-card">
                  <div className="section-heading">
                    <h2>Our favorite people</h2>
                    <span className="pill">THE CREW</span>
                  </div>
                  <div className="people-grid">
                    {people.map((p) => (
                      <button
                        key={p.id}
                        className={`person-card ${person === p.id ? "is-you" : ""}`}
                        onClick={() =>
                          run(
                            () => saveSettings({ person: p.id }),
                            `You’re planning as ${p.name}.`,
                          )
                        }
                      >
                        <Avatar person={p.id} size={88} />
                        <strong>{p.name}</strong>
                        <span>
                          {p.id === person ? (
                            <>
                              <span className="person-dot" />
                              That’s you
                            </>
                          ) : (
                            "On the adventure"
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="crew-note">
                    <Heart size={16} />
                    <span>One crew, one shared adventure.</span>
                  </div>
                </section>
              </div>
              <div className="quick-grid">
                <button className="quick-card" onClick={() => edit("activity")}>
                  <span className="quick-icon peach">
                    <CalendarDays />
                  </span>
                  <div>
                    <strong>Make a plan</strong>
                    <span>Add a little adventure</span>
                  </div>
                  <Plus size={19} />
                </button>
                <button className="quick-card" onClick={() => edit("expense")}>
                  <span className="quick-icon sage">
                    <Wallet />
                  </span>
                  <div>
                    <strong>Split something</strong>
                    <span>Good times, fair shares</span>
                  </div>
                  <Plus size={19} />
                </button>
                <button className="quick-card" onClick={() => edit("document")}>
                  <span className="quick-icon lilac">
                    <Paperclip />
                  </span>
                  <div>
                    <strong>Keep it handy</strong>
                    <span>Tickets, bookings & more</span>
                  </div>
                  <Plus size={19} />
                </button>
              </div>
              <div className="lower-grid">
                <section className="surface">
                  <div className="section-heading">
                    <h2>Up next, together</h2>
                    <button className="text-link" onClick={() => go("plan")}>
                      The whole plan
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {rows.some((r) => r.kind === "activity") ? (
                    <div className="compact-events">
                      {rows
                        .filter(
                          (r) =>
                            r.kind === "activity" && r.data.status !== "Done",
                        )
                        .sort(sortPlan)
                        .slice(0, 3)
                        .map((row) => (
                          <div className="compact-event" key={row.id}>
                            <span className="event-icon">
                              <MapPin size={18} />
                            </span>
                            <div>
                              <strong>{row.data.title}</strong>
                              <span>
                                {row.data.city} · {formatDate(row.data.date)}
                                {row.data.time ? ` · ${row.data.time}` : ""}
                              </span>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`View ${row.data.title}`}
                              onClick={() => {
                                setCity(row.data.city || "All destinations");
                                go("plan");
                              }}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </div>
                        ))}
                      {!rows.some(
                        (r) =>
                          r.kind === "activity" && r.data.status !== "Done",
                      ) && (
                        <p className="help">
                          All planned activities are done. Time for the next
                          adventure?
                        </p>
                      )}
                    </div>
                  ) : (
                    <Empty
                      icon={<CalendarDays />}
                      title="The best days start somewhere"
                      action={() => edit("activity")}
                      label="Add our first plan"
                    >
                      A coffee stop, a city walk, or a whole-day adventure.
                    </Empty>
                  )}
                </section>
                <section className="surface decision-card">
                  <div className="section-heading">
                    <h2>Let’s decide</h2>
                    <span className="pill coral">TOGETHER</span>
                  </div>
                  {rows.some(
                    (r) => r.kind === "stay" && r.data.status !== "Booked",
                  ) ? (
                    <>
                      {rows
                        .filter(
                          (r) =>
                            r.kind === "stay" && r.data.status !== "Booked",
                        )
                        .slice(0, 2)
                        .map((row) => (
                          <div className="decision-stay" key={row.id}>
                            <div>
                              <strong>{row.data.title}</strong>
                              <span>
                                {row.data.city} · {row.data.votes?.length || 0}{" "}
                                votes
                              </span>
                            </div>
                            <button
                              className={`vote-button ${row.data.votes?.includes(person) ? "voted" : ""}`}
                              onClick={() => toggleVote(row)}
                              aria-pressed={
                                row.data.votes?.includes(person) || false
                              }
                            >
                              <Heart size={16} />
                              {row.data.votes?.includes(person)
                                ? "Voted"
                                : "Vote"}
                            </button>
                          </div>
                        ))}
                      <button className="text-link" onClick={() => go("stays")}>
                        See the shortlist
                        <ArrowUpRight size={15} />
                      </button>
                    </>
                  ) : (
                    <Empty
                      icon={<BedDouble />}
                      title="Find our little corner"
                      action={() => edit("stay")}
                      label="Save a stay"
                    >
                      Collect the options, then let the crew pick a favorite.
                    </Empty>
                  )}
                </section>
              </div>
              <div className="lower-grid">
                <section className="surface activity-feed">
                  <div className="section-heading">
                    <h2>From the crew</h2>
                    <span className="muted">The latest little updates</span>
                  </div>
                  {rows
                    .filter((r) => !r.data.isStarter)
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                    .slice(0, 4)
                    .map((row) => (
                      <div className="feed-row" key={row.id}>
                        <Avatar person={row.by} size={36} />
                        <div>
                          <p>
                            <strong>
                              {people.find((p) => p.id === row.by)?.name}
                            </strong>{" "}
                            {row.revision ? "updated" : "added"}{" "}
                            <strong>{row.data.title}</strong>
                          </p>
                          <span>
                            {row.kind} ·{" "}
                            {new Date(row.updatedAt).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  {!rows.some((r) => !r.data.isStarter) && (
                    <p className="quiet-copy">
                      The crew’s saves, plans, and expenses will appear here.
                      Who’s going first?
                    </p>
                  )}
                </section>
                <section className="money-peek">
                  <span className="eyebrow">MEMORIES, WITHOUT THE MATH</span>
                  <div className="row">
                    <div>
                      <p className="money-number">
                        {money(
                          rows
                            .filter((r) => r.kind === "expense")
                            .reduce((n, r) => n + toCents(r.data), 0) / 100,
                        )}
                      </p>
                      <p>spent together so far</p>
                    </div>
                    <span className="money-doodle" aria-hidden="true">
                      ✺
                    </span>
                  </div>
                  <button className="text-link" onClick={() => go("money")}>
                    Keep the balance
                    <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page !== "crew" && page !== "settings" && (
            <>
              <div className="page-intro">
                <div>
                  <p className="eyebrow">
                    TURBOCOLOMBIA /{" "}
                    {page === "money" ? "KEEP IT FAIR" : "MAKE IT OURS"}
                  </p>
                  <h1>
                    {page === "plan" ? (
                      <>
                        A plan with
                        <br className="mobile-break" /> room to <em>wander.</em>
                      </>
                    ) : page === "stays" ? (
                      <>
                        Find our <em>little corner.</em>
                      </>
                    ) : page === "discover" ? (
                      <>
                        Good things <em>ahead.</em>
                      </>
                    ) : page === "documents" ? (
                      <>
                        Less searching.
                        <br />
                        <em>More going.</em>
                      </>
                    ) : (
                      <>
                        Split the bill.
                        <br />
                        <em>Keep the vibe.</em>
                      </>
                    )}
                  </h1>
                  <p className="intro-copy">
                    {page === "plan"
                      ? "Shape the days. Move things around. Leave space for a detour."
                      : page === "stays"
                        ? "All our maybes, favorites, and “this is the one”s."
                        : page === "discover"
                          ? "Worth a wander. Worth a taste. Worth saving for later."
                          : page === "documents"
                            ? "The important stuff, right where you need it."
                            : "Who paid, who owes, and who’s getting the next coffee."}
                  </p>
                </div>
                {page === "plan"
                  ? addButton("activity", "Add a plan")
                  : page === "stays"
                    ? addButton("stay", "Save a stay")
                    : page === "discover"
                      ? addButton("idea", "Save an idea")
                      : page === "documents"
                        ? addButton("document", "Add a document")
                        : addButton("expense", "Add an expense")}
              </div>
              <div className="destination-filter">
                <MapPin size={16} />
                <label className="sr-only" htmlFor="city-filter">
                  Filter by destination
                </label>
                <select
                  id="city-filter"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option>All destinations</option>
                  {Array.from(
                    new Set([
                      ...stops.map((s) => s.data.title),
                      ...(rows
                        .map((r) => r.data.city)
                        .filter(Boolean) as string[]),
                    ]),
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <span>
                  {city === "All destinations"
                    ? "The whole adventure"
                    : "Just this chapter"}
                </span>
              </div>
            </>
          )}
          {page === "plan" && (
            <>
              <div className="section-heading">
                <h2>The route</h2>
                <button
                  className="button subtle"
                  onClick={() => edit("destination")}
                >
                  <Plus size={16} />
                  Add a destination
                </button>
              </div>
              <div className="route-grid">
                {stops.map((row, i) => (
                  <div className={`route-stop route-${i % 3}`} key={row.id}>
                    <div className="row">
                      <span className="eyebrow">
                        CHAPTER {String(i + 1).padStart(2, "0")}
                      </span>
                      {i % 3 === 0 ? (
                        <Mountain size={25} />
                      ) : i % 3 === 1 ? (
                        <Palmtree size={25} />
                      ) : (
                        <Sun size={25} />
                      )}
                    </div>
                    <h3>{row.data.title}</h3>
                    <p>
                      {row.data.date
                        ? `${formatDate(row.data.date)}${row.data.endDate ? ` – ${formatDate(row.data.endDate)}` : ""}`
                        : "Dates to decide"}
                    </p>
                    {row.data.isStarter && (
                      <span className="starter-label">
                        Suggested stop · make it yours
                      </span>
                    )}
                    <div className="row route-stop-bottom">
                      <button
                        className="text-link"
                        onClick={() =>
                          setCity(
                            city === row.data.title
                              ? "All destinations"
                              : row.data.title,
                          )
                        }
                      >
                        {city === row.data.title
                          ? "Show all"
                          : "Explore this chapter"}
                        <ArrowRight size={14} />
                      </button>
                      {actions(
                        row,
                        <>
                          <button
                            className="icon-button"
                            aria-label={`Move ${row.data.title} earlier`}
                            disabled={i === 0}
                            onClick={() =>
                              run(async () => {
                                await editRow(row, { order: i - 1 });
                                await editRow(stops[i - 1], { order: i });
                              })
                            }
                          >
                            <ArrowLeft size={14} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Move ${row.data.title} later`}
                            disabled={i === stops.length - 1}
                            onClick={() =>
                              run(async () => {
                                await editRow(row, { order: i + 1 });
                                await editRow(stops[i + 1], { order: i });
                              })
                            }
                          >
                            <ArrowRight size={14} />
                          </button>
                        </>,
                      )}
                    </div>
                  </div>
                ))}
                {!stops.length && (
                  <Empty
                    icon={<Route />}
                    title="Where shall we begin?"
                    action={() => edit("destination")}
                    label="Add our first destination"
                  >
                    A big city, a little village, or somewhere by the sea.
                  </Empty>
                )}
              </div>
              <PlanList
                rows={filtered
                  .filter((r) => r.kind === "activity")
                  .sort(sortPlan)}
                onEdit={(r) => edit("activity", r)}
                onDelete={setConfirmDelete}
                onDone={(r) =>
                  run(() =>
                    editRow(r, {
                      status: r.data.status === "Done" ? "Planned" : "Done",
                    }),
                  )
                }
                onAddDoc={(r) =>
                  edit("document", undefined, {
                    activityId: r.id,
                    city: r.data.city,
                  })
                }
                docsFor={docsFor}
                onAdd={() => edit("activity")}
              />
            </>
          )}
          {page === "stays" && (
            <>
              <div className="section-heading">
                <h2>
                  The shortlist{" "}
                  <span className="inline-count">
                    {filtered.filter((r) => r.kind === "stay").length}
                  </span>
                </h2>
                <p className="muted">
                  Vote with your avatar. Book when it feels right.
                </p>
              </div>
              <div className="stays-grid">
                {filtered
                  .filter((r) => r.kind === "stay")
                  .map((row, i) => (
                    <article className="stay-card surface" key={row.id}>
                      <div className={`stay-art stay-art-${i % 3}`}>
                        <div className="stay-window">
                          <span />
                          <span />
                        </div>
                        <div className="stay-plant" />
                        <span className="pill">
                          {row.data.status === "Planned"
                            ? "Shortlisted"
                            : row.data.status}
                        </span>
                        <div className="stay-art-label">
                          {row.data.city || "A place for the crew"}
                        </div>
                      </div>
                      <div className="stay-body">
                        <div className="row">
                          <h3>{row.data.title}</h3>
                          {actions(row)}
                        </div>
                        <p className="muted">
                          {row.data.date
                            ? `${formatDate(row.data.date)} – ${formatDate(row.data.endDate)}`
                            : "Dates still flexible"}
                        </p>
                        {row.data.notes && (
                          <p className="item-notes">{row.data.notes}</p>
                        )}
                        <div className="stay-price">
                          {row.data.amount
                            ? money(row.data.amount, row.data.currency)
                            : "Price to check"}
                          <span>
                            {row.data.amount ? "total stay price" : ""}
                          </span>
                        </div>
                        <External url={row.data.url}>Open listing</External>
                        {docsFor(row)}
                        <div className="stay-vote-row">
                          <div className="voter-avatars">
                            {row.data.votes?.map((p) => (
                              <Avatar key={p} person={p} size={28} />
                            ))}
                            <span>{row.data.votes?.length || 0}/4 votes</span>
                          </div>
                          <button
                            className={`vote-button ${row.data.votes?.includes(person) ? "voted" : ""}`}
                            aria-pressed={
                              row.data.votes?.includes(person) || false
                            }
                            onClick={() => toggleVote(row)}
                          >
                            <Heart size={16} />
                            {row.data.votes?.includes(person)
                              ? "Your pick"
                              : "Vote for this"}
                          </button>
                        </div>
                        <div className="row">
                          <Byline person={row.by} />
                          <button
                            className="icon-button"
                            aria-label={`Attach booking to ${row.data.title}`}
                            onClick={() =>
                              edit("document", undefined, {
                                activityId: row.id,
                                city: row.data.city,
                              })
                            }
                          >
                            <Paperclip size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {!filtered.some((r) => r.kind === "stay") && (
                <Empty
                  icon={<BedDouble />}
                  title="Let’s find our home away from home"
                  action={() => edit("stay")}
                  label="Save a stay"
                >
                  Paste an Airbnb, Booking.com, or hotel link. Compare prices,
                  collect votes, and choose together.
                </Empty>
              )}
            </>
          )}
          {page === "discover" && (
            <Discover
              rows={filtered}
              allRows={rows}
              city={city}
              onAdd={(d) => edit("idea", undefined, d)}
              onPlan={(d) =>
                edit("activity", undefined, { ...d, status: "Planned" })
              }
              actions={actions}
              notify={notify}
              run={run}
            />
          )}
          {page === "documents" && (
            <>
              <div className="documents-toolbar">
                <div className="document-tip">
                  <WifiOff size={18} />
                  <div>
                    <strong>Keep the important stuff close</strong>
                    <p>
                      Added files stay on this phone. Download shared files
                      before heading offline.
                    </p>
                  </div>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    run(
                      cacheAllDocuments,
                      "All available documents are saved on this phone for offline use.",
                    )
                  }
                >
                  <Download size={16} />
                  Keep all offline
                </button>
              </div>
              <div className="documents-list">
                {filtered
                  .filter((r) => r.kind === "document")
                  .map((row) => (
                    <DocumentItem
                      key={row.id}
                      row={row}
                      link={rows.find((r) => r.id === row.data.activityId)}
                      onOpen={() => openDoc(row)}
                      actions={actions(row)}
                    />
                  ))}
              </div>
              {!filtered.some((r) => r.kind === "document") && (
                <Empty
                  icon={<FolderOpen />}
                  title="A pocket for the important stuff"
                  action={() => edit("document")}
                  label="Add a document"
                >
                  Booking confirmations, flight tickets, entrance passes. Attach
                  them to the plan so they’re easy to find.
                </Empty>
              )}
            </>
          )}
          {page === "money" && (
            <Money
              rows={filtered}
              allRows={rows}
              settings={settings}
              actions={actions}
              docsFor={docsFor}
              onSettle={async (from, to, cents) => {
                await run(
                  () =>
                    addRow("settlement", {
                      title: `${people.find((p) => p.id === from)?.name} paid ${people.find((p) => p.id === to)?.name}`,
                      amount: cents / 100,
                      currency: "EUR",
                      rate: 1,
                      paidBy: from,
                      to,
                      date: localDate(),
                    }),
                  "Payment recorded. Balances updated.",
                );
              }}
              onAddDoc={(r) =>
                edit("document", undefined, {
                  activityId: r.id,
                  city: r.data.city,
                })
              }
              notify={notify}
              run={run}
            />
          )}
          {page === "settings" && (
            <TripSettings
              settings={settings}
              rows={allRows}
              joinConfig={joinConfig}
              onJoined={() => setJoinConfig(undefined)}
              notify={notify}
              run={run}
            />
          )}
          <footer className="page-footer">
            <span>MADE FOR OUR LITTLE PARCHE</span>
            <span>Colombia, con cariño. ✳</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(
          [
            ["crew", "Crew", Users],
            ["plan", "Plan", CalendarDays],
            ["discover", "Explore", Compass],
            ["money", "Money", Wallet],
          ] as [Page, string, typeof Users][]
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            aria-label={label}
            className={page === id ? "active" : ""}
            onClick={() => go(id)}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={
            mobileMore || ["stays", "documents", "settings"].includes(page)
              ? "active"
              : ""
          }
          onClick={() => setMobileMore((v) => !v)}
          aria-expanded={mobileMore}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
      {mobileMore && (
        <div className="mobile-more">
          <button onClick={() => go("stays")}>
            <BedDouble />
            Stays
            <ChevronRight />
          </button>
          <button onClick={() => go("documents")}>
            <FolderOpen />
            Documents
            <ChevronRight />
          </button>
          <button onClick={() => go("settings")}>
            <SettingsIcon />
            Trip settings
            <ChevronRight />
          </button>
          <button
            onClick={() => {
              setMobileMore(false);
              setInstallHelp(true);
            }}
          >
            <Download />
            Add to home screen
            <ChevronRight />
          </button>
        </div>
      )}
      {editor && (
        <Modal
          title={`${editor.row ? "Edit" : editor.kind === "document" ? "Attach" : "Add"} ${editor.kind === "activity" ? "a plan" : editor.kind === "expense" ? "an expense" : editor.kind === "idea" ? "an idea" : editor.kind === "stay" ? "a stay" : editor.kind === "destination" ? "a destination" : "a document"}`}
          onClose={closeEditor}
        >
          <EntityForm
            editor={editor}
            rows={rows}
            settings={settings}
            onSaved={() => {
              closeEditor();
              notify(
                settings.cloud
                  ? "Saved. We’ll sync it with the crew."
                  : "Saved on this phone.",
              );
            }}
          />
        </Modal>
      )}
      {(!settings.onboardingDone || profile) && (
        <Modal
          title={
            settings.onboardingDone
              ? "Who’s planning?"
              : "Welcome to the parche"
          }
          onClose={settings.onboardingDone ? closeProfile : () => {}}
        >
          <Profile
            settings={settings}
            onDone={() => setProfile(false)}
            notify={notify}
          />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Remove this from the trip?" onClose={closeDelete}>
          <p className="modal-copy">
            “{confirmDelete.data.title}” will be removed
            {settings.cloud ? " for the whole crew" : ""}. Attached documents
            remain in your trip pocket.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={closeDelete}>
              Keep it
            </button>
            <button
              className="button danger"
              onClick={() =>
                run(async () => {
                  await deleteRow(confirmDelete);
                  setConfirmDelete(undefined);
                }, "Removed from the trip.")
              }
            >
              Remove
              <Trash2 size={16} />
            </button>
          </div>
        </Modal>
      )}
      {installHelp && (
        <Modal
          title="A little Colombia on your home screen"
          onClose={() => setInstallHelp(false)}
        >
          <div className="install-copy">
            <p>
              <strong>iPhone / iPad</strong>Open this app in Safari, tap Share,
              then “Add to Home Screen”.
            </p>
            <p>
              <strong>Android</strong>Open in Chrome, tap the menu, then “Add to
              Home screen” or “Install app”.
            </p>
            <p>
              <strong>Before you head out</strong>Open the app once online and
              download your documents. After that, the plan stays with you.
            </p>
            {installPrompt && (
              <button
                className="button primary"
                onClick={() =>
                  run(async () => {
                    await installPrompt.prompt();
                    setInstallPrompt(undefined);
                    setInstallHelp(false);
                  })
                }
              >
                Install TurboColombia
                <Download size={16} />
              </button>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

function Profile({
  settings,
  onDone,
  notify,
}: {
  settings: Settings;
  onDone: () => void;
  notify: (s: string) => void;
}) {
  const [selected, setSelected] = useState<Person>(settings.person || "konrad");
  const [withStops, setWithStops] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="profile-picker">
      <p className="intro-copy">
        Pick yourself once. This phone will remember you, so the crew knows who
        added what.
      </p>
      <div className="profile-options">
        {people.map((p) => (
          <button
            key={p.id}
            className={selected === p.id ? "selected" : ""}
            onClick={() => setSelected(p.id)}
            aria-pressed={selected === p.id}
          >
            <Avatar person={p.id} size={100} />
            <strong>{p.name}</strong>
            {selected === p.id && <CheckCircle2 size={20} />}
          </button>
        ))}
      </div>
      {!settings.onboardingDone && (
        <label className="check">
          <input
            type="checkbox"
            checked={withStops}
            onChange={(e) => setWithStops(e.target.checked)}
          />
          Start with suggested stops: Bogotá, Cartagena, and Medellín
        </label>
      )}
      <p className="help">
        You can switch travelers any time. Clearing browser storage forgets this
        phone’s selection.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (settings.onboardingDone)
              await saveSettings({ person: selected });
            else await startTrip(selected, withStops);
            onDone();
            notify(`¡Vamos, ${people.find((p) => p.id === selected)?.name}!`);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Getting ready…"
          : settings.onboardingDone
            ? "That’s me"
            : "Let’s make some plans"}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function PlanList({
  rows,
  onEdit,
  onDelete,
  onDone,
  onAddDoc,
  docsFor,
  onAdd,
}: {
  rows: Row[];
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  onDone: (r: Row) => void;
  onAddDoc: (r: Row) => void;
  docsFor: (r: Row) => ReactNode;
  onAdd: () => void;
}) {
  const [day, setDay] = useState("All days");
  const dates = Array.from(
    new Set(rows.map((r) => r.data.date || "Unscheduled")),
  ).sort();
  const shown =
    day === "All days"
      ? rows
      : rows.filter((r) => (r.data.date || "Unscheduled") === day);
  return (
    <section className="plan-section">
      <div className="section-heading">
        <h2>The day-by-day</h2>
        <span className="pill">
          {rows.length} {rows.length === 1 ? "PLAN" : "PLANS"}
        </span>
      </div>
      <div className="day-tabs">
        <button
          className={day === "All days" ? "selected" : ""}
          onClick={() => setDay("All days")}
        >
          All days
        </button>
        {dates.map((date) => (
          <button
            key={date}
            onClick={() => setDay(date)}
            className={day === date ? "selected" : ""}
          >
            {date === "Unscheduled" ? "Still flexible" : formatDate(date)}
          </button>
        ))}
      </div>
      {!shown.length && (
        <Empty
          icon={<Sun />}
          title="Leave room for a very good day"
          action={onAdd}
          label="Add a plan"
        >
          Add your first activity. Dates and times can come later.
        </Empty>
      )}
      {Array.from(new Set(shown.map((r) => r.data.date || "Unscheduled"))).map(
        (date) => (
          <div key={date} className="day-group">
            <div className="day-label">
              <span className="day-dot" />
              <h3>
                {date === "Unscheduled" ? "Still flexible" : formatDate(date)}
              </h3>
              <span>
                {date === "Unscheduled"
                  ? "Ideas with a place in the plan"
                  : "Colombia time"}
              </span>
            </div>
            {shown
              .filter((r) => (r.data.date || "Unscheduled") === date)
              .map((row) => (
                <article
                  className={`plan-item ${row.data.status === "Done" ? "is-done" : ""}`}
                  key={row.id}
                >
                  <div className="plan-time">
                    {row.data.time || "Any time"}
                    <span>
                      {row.data.category === "Food" ? (
                        <Utensils size={17} />
                      ) : row.data.category === "Flight" ? (
                        <Plane size={17} />
                      ) : row.data.category === "Transport" ? (
                        <Route size={17} />
                      ) : (
                        <MapPin size={17} />
                      )}
                    </span>
                  </div>
                  <div className="plan-detail">
                    <div className="row">
                      <h3>{row.data.title}</h3>
                      <span
                        className={`pill ${row.data.status === "Booked" ? "sage" : ""}`}
                      >
                        {row.data.status || "Planned"}
                      </span>
                    </div>
                    <p className="muted">
                      <MapPin size={13} />
                      {row.data.city || "Destination to decide"} ·{" "}
                      {row.data.category}
                    </p>
                    {row.data.notes && (
                      <p className="item-notes">{row.data.notes}</p>
                    )}
                    <External url={row.data.url}>Details & booking</External>
                    {docsFor(row)}
                    <Byline person={row.by} />
                  </div>
                  <div className="plan-actions">
                    <button
                      className={`icon-button ${row.data.status === "Done" ? "done" : ""}`}
                      aria-label={
                        row.data.status === "Done"
                          ? `Mark ${row.data.title} as planned`
                          : `Mark ${row.data.title} as done`
                      }
                      onClick={() => onDone(row)}
                    >
                      <Check size={17} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onAddDoc(row)}
                      aria-label={`Attach document to ${row.data.title}`}
                    >
                      <Paperclip size={16} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onEdit(row)}
                      aria-label={`Edit ${row.data.title}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onDelete(row)}
                      aria-label={`Delete ${row.data.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
        ),
      )}
    </section>
  );
}

function DocumentItem({
  row,
  link,
  onOpen,
  actions,
}: {
  row: Row;
  link?: Row;
  onOpen: () => void;
  actions: ReactNode;
}) {
  const [cached, setCached] = useState(false);
  useEffect(() => {
    let mounted=true;
    const check=()=>{getFile(row.id).then((f)=>{if(mounted)setCached(!!f);});};
    check();window.addEventListener('turbo:files',check);
    return()=>{mounted=false;window.removeEventListener('turbo:files',check);};
  }, [row]);
  return (
    <article className="document-row">
      <span className="document-icon">
        <FileText size={25} />
      </span>
      <div className="document-info">
        <h3>{row.data.title}</h3>
        <p>
          {row.data.fileName} ·{" "}
          {row.data.size ? `${(row.data.size / 1024).toFixed(0)} KB` : ""}
        </p>
        <div className="document-meta">
          <span>{row.data.city || "Whole trip"}</span>
          {link && (
            <span>
              <Link size={12} />
              {link.data.title}
            </span>
          )}
          <span className={cached ? "offline-ready" : ""}>
            {cached ? (
              <>
                <CheckCircle2 size={12} />
                On this phone
              </>
            ) : (
              <>
                <Cloud size={12} />
                Download before going offline
              </>
            )}
          </span>
        </div>
        <Byline person={row.by} />
      </div>
      <div className="document-actions">
        <button
          className="button secondary"
          onClick={() => {
            onOpen();
            setTimeout(() => getFile(row.id).then((f) => setCached(!!f)), 2000);
          }}
        >
          <Download size={16} />
          <span>Download</span>
        </button>
        {actions}
      </div>
    </article>
  );
}

function Discover({
  rows,
  allRows,
  city,
  onAdd,
  onPlan,
  actions,
  notify,
  run,
}: {
  rows: Row[];
  allRows: Row[];
  city: string;
  onAdd: (d: Partial<Data>) => void;
  onPlan: (d: Partial<Data>) => void;
  actions: (r: Row) => ReactNode;
  notify: (s: string) => void;
  run: (t: () => Promise<unknown>, s?: string) => void;
}) {
  const [tab, setTab] = useState("For the curious");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const saved = rows.filter((r) => r.kind === "idea");
  const suggestions = discoveries.filter(
    (d) =>
      (city === "All destinations" || d.city === city) &&
      (category === "All" || d.category === category) &&
      `${d.title} ${d.notes} ${d.city}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="discovery-controls">
        <div className="segmented">
          {["For the curious", "Our saved ideas"].map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Our saved ideas" && <span>{saved.length}</span>}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={16} />
          <label className="sr-only" htmlFor="idea-search">
            Search discoveries
          </label>
          <input
            id="idea-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A dish, a city, a little adventure…"
          />
        </div>
      </div>
      <div className="discovery-filters">
        {["All", "Food", "Sight", "Experience"].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c === "All"
              ? "A little of everything"
              : c === "Food"
                ? "Worth a taste"
                : c === "Sight"
                  ? "Worth a wander"
                  : "Experiences"}
          </button>
        ))}
      </div>
      <div className="reddit-banner">
        <span className="reddit-symbol">r/</span>
        <div>
          <strong>The good stuff, from real conversations.</strong>
          <p>
            Food ideas from Reddit, with original threads to explore. Community
            tips are starting points—check current details.
          </p>
        </div>
        <a
          className="button secondary"
          href={`https://www.reddit.com/search/?q=${encodeURIComponent(`${city === "All destinations" ? "Colombia" : city} local food recommendations`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore Reddit
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="ideas-grid">
        {tab === "For the curious"
          ? suggestions.map((idea, i) => {
              const already = allRows.some(
                (r) => r.kind === "idea" && r.data.source === idea.id,
              );
              return (
                <article className="idea-card" key={idea.id}>
                  <div className={`idea-art idea-art-${i % 4}`}>
                    <span>
                      {idea.category === "Food" ? (
                        <Utensils size={38} />
                      ) : (
                        <Mountain size={44} />
                      )}
                    </span>
                    <span className="pill">{idea.city}</span>
                    <span className="idea-doodle" aria-hidden="true">
                      ✳
                    </span>
                  </div>
                  <div className="idea-body">
                    <span className="eyebrow">
                      {idea.category === "Food"
                        ? "WORTH A TASTE"
                        : "WORTH A WANDER"}
                    </span>
                    <h3>{idea.title}</h3>
                    <p>{idea.notes}</p>
                    <External url={idea.url}>{idea.source}</External>
                    {idea.sourceDate && (
                      <span className="source-date">
                        Thread researched {formatDate(idea.sourceDate)}
                      </span>
                    )}
                    <div className="row idea-footer">
                      <button
                        className={`button ${already ? "subtle" : "secondary"}`}
                        disabled={already}
                        onClick={() =>
                          run(
                            () =>
                              addRow("idea", {
                                title: idea.title,
                                city: idea.city,
                                category: idea.category,
                                notes: idea.notes,
                                url: idea.url,
                                source: idea.id,
                                sourceDate: idea.sourceDate,
                              }),
                            `Saved ${idea.title} to the crew’s ideas.`,
                          )
                        }
                      >
                        {already ? <Check size={15} /> : <Heart size={15} />}{" "}
                        {already ? "Saved" : "Save idea"}
                      </button>
                      <button
                        className="icon-button"
                        onClick={() =>
                          onPlan({
                            title: idea.title,
                            city: idea.city,
                            category: idea.category,
                            notes: idea.notes,
                            url: idea.url,
                          })
                        }
                        aria-label={`Plan ${idea.title}`}
                      >
                        <CalendarDays size={19} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          : saved
              .filter(
                (r) =>
                  (category === "All" || r.data.category === category) &&
                  `${r.data.title} ${r.data.notes || ""} ${r.data.city || ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((row) => (
                <article className="idea-card saved-idea" key={row.id}>
                  <div className="idea-body">
                    <div className="row">
                      <span className="pill">
                        {row.data.city || "Somewhere in Colombia"}
                      </span>
                      {actions(row)}
                    </div>
                    <h3>{row.data.title}</h3>
                    <p>{row.data.notes || "A little something to explore."}</p>
                    <External url={row.data.url}>Original source</External>
                    <Byline person={row.by} />
                    <button
                      className="button secondary full"
                      onClick={() => onPlan({ ...row.data, source: undefined })}
                    >
                      <CalendarDays size={16} />
                      Add to the plan
                    </button>
                  </div>
                </article>
              ))}
      </div>
      {((tab === "For the curious" && !suggestions.length) ||
        (tab === "Our saved ideas" && !saved.length)) && (
        <Empty
          icon={<Compass />}
          title="Something good is waiting"
          action={() => onAdd({})}
          label="Save an idea"
        >
          Save a tip, a Reddit thread, or that place a friend told you about.
        </Empty>
      )}
      <div className="research-note">
        <CircleHelp size={17} />
        <p>
          This collection is curated, not a live Reddit feed. Find a useful
          thread? Use “Save an idea” to keep its link and your notes.
        </p>
      </div>
    </>
  );
}

function Money({
  rows,
  allRows,
  settings,
  actions,
  docsFor,
  onSettle,
  onAddDoc,
  notify,
  run,
}: {
  rows: Row[];
  allRows: Row[];
  settings: Settings;
  actions: (r: Row, extra?: ReactNode) => ReactNode;
  docsFor: (r: Row) => ReactNode;
  onSettle: (f: Person, t: Person, c: number) => Promise<void>;
  onAddDoc: (r: Row) => void;
  notify: (s: string) => void;
  run: (t: () => Promise<unknown>, s?: string) => void;
}) {
  const [amount, setAmount] = useState("45000");
  const [from, setFrom] = useState<Currency>("COP");
  const [to, setTo] = useState<Currency>("EUR");
  const [settling, setSettling] = useState<{
    from: Person;
    to: Person;
    cents: number;
  }>();
  const closeSettle = useCallback(() => setSettling(undefined), []);
  const expenses = rows
    .filter((r) => r.kind === "expense")
    .sort((a, b) =>
      (b.data.date || b.updatedAt).localeCompare(a.data.date || a.updatedAt),
    );
  const total = expenses.reduce((n, r) => n + toCents(r.data), 0);
  const wholeTotal = allRows
    .filter((r) => r.kind === "expense")
    .reduce((n, r) => n + toCents(r.data), 0);
  const balance = balances(allRows),
    settlements = transfers(balance);
  const categories = Array.from(
    new Set(expenses.map((r) => r.data.category || "Other")),
  )
    .map((category) => ({
      category,
      cents: expenses
        .filter((r) => (r.data.category || "Other") === category)
        .reduce((n, r) => n + toCents(r.data), 0),
    }))
    .sort((a, b) => b.cents - a.cents);
  const converted =
    ((Number(amount) || 0) / rateFor(from, settings)) * rateFor(to, settings);
  async function refresh() {
    await run(async () => {
      const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok)
        throw Error(
          "Could not fetch exchange rates. You can set rates in Trip settings.",
        );
      const data = await response.json();
      if (
        data.result !== "success" ||
        ![data.rates?.COP, data.rates?.PLN, data.rates?.USD].every(
          (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
        )
      )
        throw Error("The rate provider returned an unexpected response.");
      await saveSettings({
        rate: data.rates.COP,
        plnRate: data.rates.PLN,
        usdRate: data.rates.USD,
        rateDate: new Date(data.time_last_update_unix * 1000).toISOString(),
        rateSource: "ExchangeRate-API",
      });
    }, "Latest available rates saved. Existing expenses keep their recorded rates.");
  }
  return (
    <>
      <div className="money-layout">
        <div>
          <section className="spend-overview">
            <span className="eyebrow">
              WHAT WE’VE SPENT
              {rows.length !== allRows.length ? " · CURRENT DESTINATION" : ""}
            </span>
            <p className="spend-total">{money(total / 100)}</p>
            <p>
              {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}{" "}
              · converted at each expense’s recorded rate
            </p>
            {settings.budget > 0 && (
              <div className="budget-track">
                <div className="row">
                  <span>Whole-trip budget</span>
                  <strong>
                    {money(wholeTotal / 100)} / {money(settings.budget)}
                  </strong>
                </div>
                <progress
                  value={Math.min(wholeTotal / 100, settings.budget)}
                  max={settings.budget}
                />
                <p>
                  {wholeTotal / 100 > settings.budget
                    ? `${money(wholeTotal / 100 - settings.budget)} over budget`
                    : `${money(settings.budget - wholeTotal / 100)} left for good times`}
                </p>
              </div>
            )}
          </section>
          <section className="surface balances-card">
            <div className="section-heading">
              <h2>All square?</h2>
              <span className="pill sage">WHOLE TRIP</span>
            </div>
            <div className="balance-people">
              {people.map((p) => (
                <div key={p.id}>
                  <Avatar person={p.id} size={42} />
                  <strong>{p.name}</strong>
                  <span className={balance[p.id] > 0 ? "positive" : ""}>
                    {money(Math.abs(balance[p.id]) / 100)}
                  </span>
                  <small>
                    {balance[p.id] > 0
                      ? "gets back"
                      : balance[p.id] < 0
                        ? "owes"
                        : "all settled"}
                  </small>
                </div>
              ))}
            </div>
            {settlements.length > 0 ? (
              <div className="settlements">
                {settlements.map((transfer, i) => (
                  <div className="settlement" key={i}>
                    <div>
                      <strong>
                        {people.find((p) => p.id === transfer.from)?.name}
                        <ArrowRight size={14} />
                        {people.find((p) => p.id === transfer.to)?.name}
                      </strong>
                      <span>{money(transfer.cents / 100)}</span>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setSettling(transfer)}
                    >
                      Record payment
                      <Check size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="settled">
                <CheckCircle2 size={18} />
                Good company. Clear balances.
              </div>
            )}
          </section>
        </div>
        <aside className="money-aside">
          <section className="converter-card">
            <div className="section-heading">
              <h2>Peso, please.</h2>
              <span aria-hidden="true">↗</span>
            </div>
            <p>A little currency help, wherever we are.</p>
            <Field label="Amount">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="any"
                inputMode="decimal"
              />
            </Field>
            <div className="currency-pair">
              <Field label="From">
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value as Currency)}
                >
                  {["COP", "EUR", "PLN", "USD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <button
                className="icon-button"
                aria-label="Swap currencies"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
              >
                <ArrowRight size={18} />
              </button>
              <Field label="To">
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value as Currency)}
                >
                  {["EUR", "COP", "PLN", "USD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <output aria-live="polite">{money(converted, to)}</output>
            <p className="rate-note">
              {settings.rateDate
                ? `${settings.rateSource || "Manual rate"} · ${new Date(settings.rateDate).toLocaleDateString("en-GB")}`
                : "Illustrative rates · refresh or set your own before use."}
            </p>
            <button className="text-link" onClick={refresh}>
              <RefreshCw size={14} />
              Refresh rates
            </button>
            <a
              className="rate-attribution"
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Rates by ExchangeRate-API
            </a>
          </section>
          {categories.length > 0 && (
            <section className="surface category-spend">
              <h2>Where it went</h2>
              {categories.map(({ category, cents }) => (
                <div key={category}>
                  <div className="row">
                    <span>{category}</span>
                    <strong>{money(cents / 100)}</strong>
                  </div>
                  <progress value={cents} max={total || 1} />
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
      <section className="expenses-section">
        <div className="section-heading">
          <h2>The little things add up</h2>
          <span className="muted">
            All amounts shown in their original currency
          </span>
        </div>
        {expenses.map((row) => (
          <article className="expense-row" key={row.id}>
            <span className="expense-icon">
              {row.data.category === "Food & drink" ? (
                <Utensils size={20} />
              ) : row.data.category === "Accommodation" ? (
                <BedDouble size={20} />
              ) : (
                <Banknote size={20} />
              )}
            </span>
            <div className="expense-info">
              <h3>{row.data.title}</h3>
              <p>
                {people.find((p) => p.id === row.data.paidBy)?.name} paid ·{" "}
                {(row.data.split || [])
                  .map((p) => people.find((x) => x.id === p)?.name)
                  .join(", ")}
              </p>
              <p>
                {row.data.city && `${row.data.city} · `}
                {row.data.date ? formatDate(row.data.date) : "No date"} ·{" "}
                {row.data.category}
              </p>
              <Byline person={row.by} label="Recorded by" />
              {docsFor(row)}
              {row.data.notes && <p className="item-notes">{row.data.notes}</p>}
            </div>
            <div className="expense-amount">
              <strong>{money(row.data.amount || 0, row.data.currency)}</strong>
              <span>
                {money(toCents(row.data) / 100)} · 1 EUR = {row.data.rate}{" "}
                {row.data.currency}
              </span>
              {actions(
                row,
                <button
                  className="icon-button"
                  onClick={() => onAddDoc(row)}
                  aria-label={`Attach receipt to ${row.data.title}`}
                >
                  <Paperclip size={16} />
                </button>,
              )}
            </div>
          </article>
        ))}
        {!expenses.length && (
          <Empty icon={<Wallet />} title="First coffee’s on someone">
            Add an expense above, choose who paid, and split it between the
            right people.
          </Empty>
        )}
      </section>
      {allRows.some((r) => r.kind === "settlement") && (
        <section className="surface payment-history">
          <h2>Payments between us</h2>
          {allRows
            .filter((r) => r.kind === "settlement")
            .map((row) => (
              <div className="row" key={row.id}>
                <div>
                  <strong>{row.data.title}</strong>
                  <p className="muted">
                    {money(row.data.amount || 0)} · {formatDate(row.data.date)}
                  </p>
                </div>
                {actions(row)}
              </div>
            ))}
        </section>
      )}
      {settling && (
        <Modal title="Did this payment happen?" onClose={closeSettle}>
          <p className="modal-copy">
            Record{" "}
            <strong>{people.find((p) => p.id === settling.from)?.name}</strong>{" "}
            paying <strong>{money(settling.cents / 100)}</strong> to{" "}
            <strong>{people.find((p) => p.id === settling.to)?.name}</strong>.
          </p>
          <p className="help">
            This records a payment you made elsewhere. TurboColombia does not
            transfer money.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={closeSettle}>
              Not yet
            </button>
            <button
              className="button primary"
              onClick={async () => {
                await onSettle(settling.from, settling.to, settling.cents);
                closeSettle();
              }}
            >
              Yes, paid
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function TripSettings({
  settings,
  rows,
  joinConfig,
  onJoined,
  notify,
  run,
}: {
  settings: Settings;
  rows: Row[];
  joinConfig?: { url: string; key: string; invite: string };
  onJoined: () => void;
  notify: (s: string) => void;
  run: (t: () => Promise<unknown>, s?: string) => void;
}) {
  const [name, setName] = useState(settings.tripName);
  const [start, setStart] = useState(settings.startDate || "");
  const [end, setEnd] = useState(settings.endDate || "");
  const [budget, setBudget] = useState(String(settings.budget || ""));
  const [rates, setRates] = useState({
    cop: String(settings.rate),
    pln: String(settings.plnRate),
    usd: String(settings.usdRate),
  });
  const [cloudUrl, setCloudUrl] = useState(joinConfig?.url || "");
  const [cloudKey, setCloudKey] = useState(joinConfig?.key || "");
  const [invite, setInvite] = useState(joinConfig?.invite || "");
  const [mode, setMode] = useState(joinConfig ? "join" : "create");
  const [confirmed, setConfirmed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [storage, setStorage] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const sync = useSyncExternalStore(syncSubscribe, syncSnapshot);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File>();
  const closeRestore = useCallback(() => setRestoreFile(undefined), []);
  useEffect(() => {
    storageEstimate().then((s) => {
      if (s)
        setStorage(
          `${((s.usage || 0) / 1024 / 1024).toFixed(1)} MB saved on this device`,
        );
    });
  }, [rows]);
  useEffect(() => {
    if (joinConfig) {
      setCloudUrl(joinConfig.url);
      setCloudKey(joinConfig.key);
      setInvite(joinConfig.invite);
      setMode("join");
    }
  }, [joinConfig]);
  const conflicts = rows.filter((r) => r.conflict);
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setConnectionError("");
    setConnecting(true);
    try {
      await connectTrip(
        cloudUrl.trim(),
        cloudKey.trim(),
        mode === "join" ? invite.trim() : undefined,
      );
      onJoined();
      notify(
        "Your crew is connected. Share the invite with the other three phones.",
      );
    } catch (e) {
      setConnectionError(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">A FEW LITTLE DETAILS</p>
          <h1>
            Make it <em>ours.</em>
          </h1>
          <p className="intro-copy">
            The adventure, the crew, and a little peace of mind.
          </p>
        </div>
        <span className="settings-spark" aria-hidden="true">
          ✳
        </span>
      </div>
      <div className="settings-grid">
        <section className="surface settings-card">
          <div className="section-heading">
            <h2>The adventure</h2>
            <Sun size={22} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (start && end && end < start) {
                notify("The end date must be after the start date.");
                return;
              }
              run(
                () =>
                  saveSettings({
                    tripName: name.trim() || defaults.tripName,
                    startDate: start,
                    endDate: end,
                    budget: Number(budget) || 0,
                  }),
                "Trip details saved on this phone.",
              );
            }}
          >
            <Field label="Trip name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </Field>
            <div className="form-grid">
              <Field label="Adventure begins">
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Until next time">
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Whole-trip budget · EUR (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <p className="help">
              These preferences are specific to this phone. Plans, stays,
              expenses, and documents sync with your connected trip.
            </p>
            <button className="button primary" type="submit">
              Save trip details
              <Check size={16} />
            </button>
          </form>
        </section>
        <section className="surface settings-card">
          <div className="section-heading">
            <h2>Keep the crew connected</h2>
            <Cloud size={22} />
          </div>
          {settings.cloud ? (
            <>
              <div className="connected-state">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Your trip is connected</strong>
                  <p>{sync.message}</p>
                </div>
              </div>
              <p className="settings-copy">
                Send the private invite to Gaba, Janek, Konrad, and Julia. Each
                phone chooses its avatar, then shares the same adventure.
              </p>
              <button
                className="button primary full"
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(inviteLink());
                  }, "Trip invite copied. Send it privately to the crew.")
                }
              >
                <Copy size={16} />
                Copy crew invite
              </button>
              <button
                className="button secondary full"
                onClick={() => void syncTrip()}
              >
                <RefreshCw size={16} />
                Sync now
              </button>
              <p className="help">
                Anyone with your invite can access and edit the trip. Keep it
                within the crew.
              </p>
              <button
                className="text-link"
                onClick={() =>
                  run(
                    disconnectTrip,
                    "Disconnected on this phone. Your local trip is kept.",
                  )
                }
              >
                Disconnect this phone
              </button>
            </>
          ) : (
            <>
              <p className="settings-copy">
                Ready to plan together? Connect once, then send the crew an
                invite. No login screen needed.
              </p>
              <details className="setup-details">
                <summary>First-time setup instructions</summary>
                <ol>
                  <li>Create a free Supabase project.</li>
                  <li>
                    Run the repository’s <code>supabase/schema.sql</code> in its
                    SQL Editor.
                  </li>
                  <li>
                    Under Authentication → Sign In / Providers, enable Anonymous
                    Sign-Ins.
                  </li>
                  <li>
                    From project settings, copy the project URL and publishable
                    (or anon) key below.
                  </li>
                  <li>Create the shared trip, then copy the crew invite.</li>
                </ol>
                <p>
                  Use a publishable key. Keep secret and service-role keys out
                  of this app.
                </p>
                <External url="https://supabase.com/dashboard">
                  Open Supabase
                </External>
              </details>
              <div className="segmented">
                {["create", "join"].map((m) => (
                  <button
                    key={m}
                    className={mode === m ? "selected" : ""}
                    onClick={() => setMode(m)}
                  >
                    {m === "create" ? "Create shared trip" : "Join the crew"}
                  </button>
                ))}
              </div>
              <form onSubmit={connect}>
                <Field label="Project URL">
                  <input
                    type="url"
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    required
                  />
                </Field>
                <Field label="Publishable / anon key">
                  <input
                    value={cloudKey}
                    onChange={(e) => setCloudKey(e.target.value)}
                    placeholder="sb_publishable_…"
                    required
                    autoComplete="off"
                  />
                </Field>
                {mode === "join" && (
                  <>
                    <Field label="Trip invite code">
                      <input
                        value={invite}
                        onChange={(e) => setInvite(e.target.value)}
                        required
                        pattern="[a-f0-9]{64}"
                      />
                    </Field>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        required
                      />
                      I’ve backed up this phone’s plans. Joining replaces this
                      phone’s current trip.
                    </label>
                  </>
                )}
                {connectionError && (
                  <p className="form-error" role="alert">
                    {connectionError}
                  </p>
                )}
                <button
                  className="button primary full"
                  disabled={connecting}
                  type="submit"
                >
                  {connecting
                    ? "Connecting…"
                    : mode === "create"
                      ? "Connect our adventure"
                      : "Join this adventure"}
                  <ArrowRight size={16} />
                </button>
              </form>
            </>
          )}
        </section>
        <section className="surface settings-card">
          <div className="section-heading">
            <h2>A little currency help</h2>
            <Banknote size={22} />
          </div>
          <p className="settings-copy">
            Set your own rates, or refresh them in Expenses. Each expense keeps
            the rate used when it was added.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const numbers = [rates.cop, rates.pln, rates.usd].map(Number);
              if (!numbers.every((n) => Number.isFinite(n) && n > 0)) {
                notify("Enter positive exchange rates.");
                return;
              }
              run(
                () =>
                  saveSettings({
                    rate: numbers[0],
                    plnRate: numbers[1],
                    usdRate: numbers[2],
                    rateDate: new Date().toISOString(),
                    rateSource: "Your manual rates",
                  }),
                "Your exchange rates are saved.",
              );
            }}
          >
            {[
              ["cop", "COP"],
              ["pln", "PLN"],
              ["usd", "USD"],
            ].map(([key, label]) => (
              <Field key={key} label={`1 EUR = … ${label}`}>
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={rates[key as keyof typeof rates]}
                  onChange={(e) =>
                    setRates((v) => ({ ...v, [key]: e.target.value }))
                  }
                  required
                />
              </Field>
            ))}
            <button className="button secondary" type="submit">
              Save rates
              <Check size={16} />
            </button>
          </form>
        </section>
        <section className="surface settings-card">
          <div className="section-heading">
            <h2>Pack a backup</h2>
            <FolderOpen size={22} />
          </div>
          <p className="settings-copy">
            Take a ZIP of your plans and documents saved on this phone. Keep a
            copy before switching devices or clearing browser storage.
          </p>
          <p className="help">
            {storage || "Trip data is stored on this device."}
          </p>
          <button
            className="button primary full"
            disabled={backupBusy}
            onClick={async () => {
              setBackupBusy(true);
              try {
                const missing = await exportBackup();
                notify(
                  missing
                    ? `Backup saved. ${missing} shared document file(s) were not on this phone and are not included. Download them first for a complete backup.`
                    : "Backup saved with your plans and local documents.",
                );
              } catch (e) {
                notify(errorMessage(e));
              } finally {
                setBackupBusy(false);
              }
            }}
          >
            <Download size={16} />
            {backupBusy ? "Packing the good stuff…" : "Export a trip backup"}
          </button>
          <label className="upload-backup">
            <Upload size={16} />
            Import a backup
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                setRestoreFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="help">
            Import adds a copy of the backup’s items to your current trip. It
            won’t remove existing plans. Your crew invite is never included in
            exports.
          </p>
          <button
            className="text-link"
            onClick={() =>
              run(async () => {
                const granted = await navigator.storage?.persist?.();
                notify(
                  granted
                    ? "This browser will try to keep the trip stored. Keep backups too."
                    : "Your browser manages storage automatically. Keep a backup before traveling.",
                );
              })
            }
          >
            <CheckCircle2 size={15} />
            Ask this browser to keep my trip
          </button>
        </section>
      </div>
      {conflicts.length > 0 && (
        <section className="surface settings-card conflict-list">
          <h2>Two ideas met at the same time</h2>
          <p className="settings-copy">
            This item changed on another phone while you were editing. Choose
            which version to keep.
          </p>
          {conflicts.map((row) => (
            <div className="conflict" key={row.id}>
              <h3>{row.data.title}</h3>
              <div className="form-grid">
                <div>
                  <strong>Your version{row.deleted ? " · removed" : ""}</strong>
                  <pre>{JSON.stringify(row.data, null, 2)}</pre>
                  <button
                    className="button secondary"
                    onClick={() =>
                      run(
                        () => resolveConflict(row, true),
                        "Your version kept.",
                      )
                    }
                  >
                    Keep mine
                  </button>
                </div>
                <div>
                  <strong>
                    Crew’s version{row.conflict?.deleted ? " · removed" : ""}
                  </strong>
                  <pre>{JSON.stringify(row.conflict?.data, null, 2)}</pre>
                  <button
                    className="button primary"
                    onClick={() =>
                      run(
                        () => resolveConflict(row, false),
                        "The crew’s version kept.",
                      )
                    }
                  >
                    Keep the crew’s
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="settings-footnote">
        <p>
          <strong>A note for the crew</strong> Your avatar identifies who is
          using this phone; it isn’t proof of someone’s identity. Choose the
          right person before recording an expense. Keep your trip invite
          private.
        </p>
        <External url="https://github.com/kw10-uw/Colombia">
          Our GitHub repository
        </External>
      </div>
      {restoreFile && (
        <Modal title="Add this backup to the trip?" onClose={closeRestore}>
          <p className="modal-copy">
            Import “{restoreFile.name}” as new items. If you already have these
            plans, importing will create duplicates.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={closeRestore}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={backupBusy}
              onClick={async () => {
                setBackupBusy(true);
                try {
                  const count = await importBackup(restoreFile);
                  setRestoreFile(undefined);
                  notify(
                    `Backup imported (${count} items read). Documents without a backed-up file were skipped.`,
                  );
                } catch (e) {
                  notify(errorMessage(e));
                } finally {
                  setBackupBusy(false);
                }
              }}
            >
              {backupBusy ? "Importing…" : "Import backup"}
              <Upload size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

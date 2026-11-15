import {
  useEffect,
  useRef,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { X, ExternalLink, ArrowUpRight } from "lucide-react";
import { people, validUrl, type Person } from "./model";
export function Avatar({
  person,
  size = 40,
}: {
  person: Person;
  size?: number;
}) {
  const p = people.find((p) => p.id === person)!;
  return (
    <img
      className="avatar"
      src={`${import.meta.env.BASE_URL}avatars/${person}.webp`}
      alt={p.name}
      width={size}
      height={size}
      style={{ background: p.color }}
    />
  );
}
export function Byline({
  person,
  label = "Added by",
}: {
  person: Person;
  label?: string;
}) {
  return (
    <span className="byline">
      <Avatar person={person} size={22} />
      {label} {people.find((p) => p.id === person)?.name}
    </span>
  );
}
export function External({
  url,
  children,
  className = "text-link",
}: {
  url?: string;
  children: ReactNode;
  className?: string;
}) {
  const safe = validUrl(url);
  return safe ? (
    <a
      className={className}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ExternalLink size={14} />
    </a>
  ) : null;
}
export function Empty({
  icon,
  title,
  children,
  action,
  label,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="button primary" onClick={action}>
          {label}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  const control =
    isValidElement(children) &&
    ["input", "select", "textarea"].includes(String(children.type))
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-labelledby": labelId,
        })
      : children;
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.querySelector<HTMLElement>("input,select,button")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && el) {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ),
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

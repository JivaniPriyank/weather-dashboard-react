import { useId, useRef, useState } from "react";
import Icon from "../../../components/Icon";
import { useSession } from "../../../lib/session";

export const TABS = [
  { id: "words", label: "Words", add: "New topic", to: "/teacher/content/topics/new" },
  { id: "quiz", label: "Quiz questions", add: "New question", to: "/teacher/content/questions/new" },
  { id: "grammar", label: "Grammar", add: "New grammar topic", to: "/teacher/content/grammar/new" },
  { id: "speaking", label: "Speaking tasks", add: "New speaking task", to: "/teacher/content/speaking/new" },
  { id: "sections", label: "Your sections", add: "New section", to: "/teacher/content/sections/new" },
];

export const ARTICLES = [
  { value: "der", label: "der" },
  { value: "die", label: "die" },
  { value: "das", label: "das" },
  { value: "", label: "–", title: "No article" },
];

// Where the "‹ Content" link of an editor goes back to.
export function backTo(level, tab) {
  return { to: `/teacher/content?level=${level}&tab=${tab}`, label: `Content · ${level} ${TABS.find((t) => t.id === tab).label.toLowerCase()}` };
}

// A level <select> for editor forms.
export function LevelSelect({ value, onChange, errors }) {
  const { levels } = useSession();
  const id = useId();
  const err = errors?.level;
  return (
    <div className={`field${err ? " has-error" : ""}`}>
      <label htmlFor={id}>Level</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {levels.map((lv) => <option key={lv.code} value={lv.code}>{lv.code} {lv.name}</option>)}
      </select>
      {err && <p className="error">{err.join(" ")}</p>}
    </div>
  );
}

export function FieldError({ errors, name }) {
  const list = errors?.[name];
  return list?.length ? <p className="error" role="alert">{list.join(" ")}</p> : null;
}

// Delete with a second, explicit click.
export function DeleteBox({ label, children, onDelete }) {
  const [busy, setBusy] = useState(false);
  return (
    <details className="danger">
      <summary>{label}</summary>
      <p>{children}</p>
      <button className="btn btn-danger btn-small" type="button" aria-disabled={busy}
        onClick={async () => { if (busy) return; setBusy(true); try { await onDelete(); } finally { setBusy(false); } }}>
        <Icon name="trash" />Yes, delete it
      </button>
    </details>
  );
}

// An editable list of short lines (speaking questions, phrases, accepted answers…).
export function LineList({ items, onChange, addLabel, placeholder, lang = "de", itemLabel }) {
  const refs = useRef([]);
  const keys = useRef([]);
  // stable keys so focus stays put while typing
  while (keys.current.length < items.length) keys.current.push(Math.random().toString(36).slice(2));
  const set = (i, v) => onChange(items.map((x, j) => (j === i ? v : x)));
  const remove = (i) => { keys.current.splice(i, 1); onChange(items.filter((_, j) => j !== i)); };
  const add = () => { onChange([...items, ""]); setTimeout(() => refs.current[items.length]?.focus(), 0); };
  return (
    <div className="line-list">
      {items.map((text, i) => (
        <div className="line-item" key={keys.current[i]}>
          <input ref={(el) => (refs.current[i] = el)} type="text" lang={lang} value={text} placeholder={placeholder}
            aria-label={`${itemLabel} ${i + 1}`} onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (i === items.length - 1) add(); else refs.current[i + 1]?.focus(); } }} />
          <button className="icon-btn icon-btn-bad" type="button" aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} onClick={() => remove(i)}><Icon name="x" /></button>
        </div>
      ))}
      <div><button className="btn-dashed" type="button" onClick={add}><Icon name="plus" />{addLabel}</button></div>
    </div>
  );
}

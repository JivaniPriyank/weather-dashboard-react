// Build a lesson from blocks: text, tables, words, sound tiles, exercises, videos…
// Nothing is saved until "Save"; the server checks every block and points at the ones to fix.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../../components/Icon";
import { useToast } from "../../../components/Toasts";
import { Async, FormError, PageHead } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { say } from "../../../lib/speech";
import { DeleteBox, LineList } from "./parts";

let seed = 0;
const key = () => `b${++seed}`;

// What each kind of block is for, and what a new one starts with.
const KINDS = [
  { type: "text", label: "Text", hint: "An explanation in your own words.", make: () => ({ body: "" }) },
  { type: "table", label: "Table", hint: "e.g. a conjugation table.", make: () => ({ headers: ["", ""], rows: [["", ""], ["", ""]] }) },
  { type: "words", label: "Word list", hint: "German words with their meaning; students can listen.", make: () => ({ items: [{ german: "", english: "" }] }) },
  { type: "tip", label: "Tip box", hint: "A yellow box for a warning or tip.", make: () => ({ body: "" }) },
  { type: "tiles", label: "Sound tiles", hint: "Big letters or sounds to tap and hear.", make: () => ({ intro: "", items: [{ big: "", small: "", say: "", note: "" }] }) },
  { type: "sounds", label: "Sound rules", hint: "A rule per line with example words to hear.", make: () => ({ intro: "", rows: [{ label: "", rule: "", words: [] }] }) },
  { type: "spell_demo", label: "Spelling example", hint: "A word spelled letter by letter.", make: () => ({ intro: "", word: "" }) },
  { type: "choice", label: "Choose the answer", hint: "Questions with 2–6 answers. Can play a sound first.", exercise: true, make: () => ({ items: [{ prompt: "", say: "", options: ["", ""], answer: 0, explain: "" }] }) },
  { type: "spell_word", label: "Hear the spelling, write the word", hint: "Students hear the letters and type the word.", exercise: true, make: () => ({ items: [{ word: "" }] }) },
  { type: "gap", label: "Fill the gap", hint: "Words with a gap and 2–4 choices, e.g. ei or ie.", exercise: true, make: () => ({ intro: "", choices: ["", ""], items: [{ text: "", answer: "" }] }) },
  { type: "spell_name", label: "Spell your name", hint: "Students type their name and see how to spell it.", make: () => ({}) },
  { type: "video", label: "Video", hint: "One of your videos of this level.", make: () => ({ video_id: "" }) },
  { type: "speaking", label: "Speaking task", hint: "A link to a speaking task they record for you.", make: () => ({ task_id: "" }) },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.type, k]));

export default function LessonEdit() {
  const { id } = useParams();
  const state = useApi(`/teacher/content/lessons/${id}/`);
  useTitle(state.data?.lesson.title);
  return <Async state={state}>{(d) => <LessonForm key={d.lesson.id} data={d} />}</Async>;
}

function LessonForm({ data }) {
  const { lesson, options } = data;
  const navigate = useNavigate();
  const toast = useToast();
  const titleId = useId();
  const [title, setTitle] = useState(lesson.title);
  const [published, setPublished] = useState(lesson.is_published);
  const [blocks, setBlocks] = useState(() => lesson.blocks.map((b) => ({ ...b, _key: key() })));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const back = { to: `/teacher/content/sections/${lesson.section.id}`, label: `${lesson.section.title} · lesson ${lesson.position} of ${lesson.count}` };

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (fn) => { setBlocks(fn); setDirty(true); };
  const setBlock = (i, b) => change((bs) => bs.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const moveBlock = (i, dir) => change((bs) => { const c = [...bs]; [c[i], c[i + dir]] = [c[i + dir], c[i]]; return c; });
  const removeBlock = (i) => change((bs) => bs.filter((_, j) => j !== i));
  const addBlock = (type, at) => {
    change((bs) => { const c = [...bs]; c.splice(at, 0, { type, heading: "", ...KIND[type].make(), _key: key() }); return c; });
  };

  const save = async (e, publish = published) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await api(`/teacher/content/lessons/${lesson.id}/`, {
        method: "PATCH", body: { title, is_published: publish, blocks: blocks.map(({ _key, ...b }) => b) },
      });
      setBlocks(res.lesson.blocks.map((b) => ({ ...b, _key: key() })));
      setPublished(res.lesson.is_published);
      setErrors({}); setError(null); setDirty(false);
      toast(res.message);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
      const first = Object.keys(err.fieldErrors || {}).find((k) => k.startsWith("block-"));
      if (first) document.getElementById(`lesson-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const res = await api(`/teacher/content/lessons/${lesson.id}/`, { method: "DELETE" });
    toast(res.message);
    navigate(back.to);
  };

  return (
    <form onSubmit={save} noValidate>
      <PageHead crumb={back} title={title || "Untitled lesson"} lang="de" actions={
        <div className="actions">
          <Link className="btn btn-secondary" to={`/sections/${lesson.section.id}/lessons/${lesson.id}`}>Preview as student</Link>
          {published
            ? <button className="btn btn-secondary" type="button" onClick={(e) => save(e, false)} aria-disabled={busy}>Make it a draft</button>
            : <button className="btn btn-secondary" type="button" onClick={(e) => save(e, true)} aria-disabled={busy}>Save and publish</button>}
          <button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      }>
        <p className="muted">
          <span className={`badge ${published ? "badge-good" : "badge-note"}`}>{published ? "Published" : "Draft"}</span>{" "}
          {published ? "Students can see this lesson." : "Only you can see this lesson until you publish it."}
          {dirty && <b className="lesson-unsaved"> · Unsaved changes</b>}
        </p>
      </PageHead>
      <FormError error={error} />
      {errors.blocks && <FormError error={errors.blocks.join(" ")} />}

      <section className="panel editor-stack">
        <div className={`field${errors.title ? " has-error" : ""}`}>
          <label htmlFor={titleId}>Lesson title</label>
          <input id={titleId} type="text" lang="de" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          {errors.title && <p className="error">{errors.title.join(" ")}</p>}
        </div>
      </section>

      <div className="block-list">
        {blocks.map((b, i) => (
          <div key={b._key}>
            <BlockCard b={b} i={i} count={blocks.length} options={options} error={errors[`block-${i}`]}
              onChange={(v) => setBlock(i, v)} onMove={(d) => moveBlock(i, d)} onRemove={() => removeBlock(i)} />
            <AddBlock onAdd={(type) => addBlock(type, i + 1)} compact={i < blocks.length - 1} />
          </div>
        ))}
        {!blocks.length && <AddBlock onAdd={(type) => addBlock(type, 0)} />}
      </div>

      <div className="lesson-savebar">
        <span className="muted">{blocks.length} block{blocks.length === 1 ? "" : "s"}{dirty ? " · unsaved changes" : ""}</span>
        <button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>

      <section className="section">
        <DeleteBox label="Delete this lesson" onDelete={remove}>This deletes “{lesson.title}” and your students' progress in it.</DeleteBox>
      </section>
    </form>
  );
}

// "+ Add a block" with the list of kinds.
function AddBlock({ onAdd, compact }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className={`add-block${compact ? " add-block-compact" : ""}`}>
        <button className="btn-dashed" type="button" onClick={() => setOpen(true)}><Icon name="plus" />Add a block here</button>
      </div>
    );
  }
  return (
    <div className="add-block-menu" role="group" aria-label="Kind of block">
      <div className="add-block-head">
        <b>Add a block</b>
        <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" /></button>
      </div>
      <div className="add-block-grid">
        {KINDS.map((k) => (
          <button key={k.type} type="button" className="add-block-kind" onClick={() => { onAdd(k.type); setOpen(false); }}>
            <b>{k.label}{k.exercise && <span className="badge badge-royal">Exercise</span>}</b>
            <span className="muted small">{k.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockCard({ b, i, count, options, error, onChange, onMove, onRemove }) {
  const headingId = useId();
  const kind = KIND[b.type];
  return (
    <section className={`panel block-card${error ? " has-error" : ""}`} id={`lesson-block-${i}`} aria-label={`Block ${i + 1}: ${kind?.label}`}>
      <div className="block-card-head">
        <span className="block-card-num">{i + 1}</span>
        <b>{kind?.label || b.type}</b>
        {kind?.exercise && <span className="badge badge-royal">Exercise</span>}
        <span className="block-card-tools">
          <button className="icon-btn" type="button" aria-label="Move block up" disabled={i === 0} onClick={() => onMove(-1)}><Icon name="up" /></button>
          <button className="icon-btn" type="button" aria-label="Move block down" disabled={i === count - 1} onClick={() => onMove(1)}><Icon name="down" /></button>
          <button className="icon-btn icon-btn-bad" type="button" aria-label="Remove block" onClick={onRemove}><Icon name="trash" /></button>
        </span>
      </div>
      {error && <p className="error" role="alert">{error.join(" ")}</p>}
      <div className="field">
        <label htmlFor={headingId}>Heading <span className="muted">(optional)</span></label>
        <input id={headingId} type="text" value={b.heading || ""} maxLength={120} onChange={(e) => onChange({ heading: e.target.value })} />
      </div>
      <BlockFields b={b} options={options} onChange={onChange} />
    </section>
  );
}

// ---------------- the fields of each kind of block ----------------
function TextArea({ label, value, onChange, rows = 4, help, lang }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} lang={lang} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

function Input({ label, value, onChange, lang, placeholder, maxLength = 300 }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" lang={lang} value={value ?? ""} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// A small table of inputs: one row per item, one column per field.
function Rows({ rows, columns, onChange, addLabel, blank, itemLabel }) {
  const firstRefs = useRef([]);
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => { onChange([...rows, { ...blank }]); setTimeout(() => firstRefs.current[rows.length]?.focus(), 0); };
  return (
    <div className="rows-edit">
      <div className="rows-edit-grid" style={{ gridTemplateColumns: `${columns.map((c) => c.width || "1fr").join(" ")} 40px` }}>
        {columns.map((c) => <span key={c.key} className="rows-edit-label">{c.label}</span>)}
        <span />
        {rows.map((r, i) => (
          <div className="rows-edit-row" key={i} style={{ display: "contents" }}>
            {columns.map((c, n) => (
              <input key={c.key} ref={n === 0 ? (el) => (firstRefs.current[i] = el) : undefined} type="text" lang={c.lang}
                aria-label={`${itemLabel} ${i + 1}: ${c.label}`} placeholder={c.placeholder} value={c.get ? c.get(r) : r[c.key] ?? ""}
                onChange={(e) => set(i, c.key, c.set ? c.set(e.target.value) : e.target.value)} />
            ))}
            <button className="icon-btn icon-btn-bad" type="button" aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}><Icon name="x" /></button>
          </div>
        ))}
      </div>
      <div><button className="btn-dashed" type="button" onClick={add}><Icon name="plus" />{addLabel}</button></div>
    </div>
  );
}

const csv = { get: (r) => (r.words || []).join(", "), set: (v) => v.split(",").map((x) => x.trimStart()) };

function BlockFields({ b, options, onChange }) {
  switch (b.type) {
    case "text":
    case "tip":
      return <TextArea label="Text" value={b.body} rows={b.type === "tip" ? 3 : 5} onChange={(body) => onChange({ body })}
        help="A blank line starts a new paragraph. Put **two stars** around words to make them bold." />;
    case "table":
      return <TableFields b={b} onChange={onChange} />;
    case "words":
      return <Rows rows={b.items} itemLabel="Word" addLabel="Add a word" blank={{ german: "", english: "" }} onChange={(items) => onChange({ items })}
        columns={[{ key: "german", label: "German (with article)", lang: "de", placeholder: "der Lehrer" }, { key: "english", label: "Meaning", placeholder: "the teacher" }]} />;
    case "tiles":
      return (
        <>
          <TextArea label="Introduction (optional)" rows={2} value={b.intro} onChange={(intro) => onChange({ intro })} />
          <Rows rows={b.items} itemLabel="Tile" addLabel="Add a tile" blank={{ big: "", small: "", say: "", note: "" }} onChange={(items) => onChange({ items })}
            columns={[
              { key: "big", label: "Big letter", width: "90px", lang: "de", placeholder: "A" },
              { key: "small", label: "Said", width: "1fr", placeholder: "ah" },
              { key: "say", label: "Plays aloud (if different)", width: "1.3fr", lang: "de", placeholder: "A" },
              { key: "note", label: "Example word", width: "1fr", lang: "de", placeholder: "Apfel" },
            ]} />
        </>
      );
    case "sounds":
      return (
        <>
          <TextArea label="Introduction (optional)" rows={2} value={b.intro} onChange={(intro) => onChange({ intro })} />
          <Rows rows={b.rows} itemLabel="Rule" addLabel="Add a rule" blank={{ label: "", rule: "", words: [] }} onChange={(rows) => onChange({ rows })}
            columns={[
              { key: "label", label: "Letters", width: "90px", lang: "de", placeholder: "ei" },
              { key: "rule", label: "How it sounds", width: "2fr", placeholder: "like English “eye”" },
              { key: "words", label: "Example words, with commas", width: "1.4fr", lang: "de", placeholder: "heißen, drei", ...csv },
            ]} />
        </>
      );
    case "spell_demo":
      return (
        <>
          <TextArea label="Introduction (optional)" rows={2} value={b.intro} onChange={(intro) => onChange({ intro })} />
          <Input label="Word to spell" lang="de" value={b.word} maxLength={40} placeholder="MARIA" onChange={(word) => onChange({ word })} />
        </>
      );
    case "choice":
      return <ChoiceFields b={b} onChange={onChange} />;
    case "spell_word":
      return (
        <div className="field">
          <span className="field-label">Words students hear spelled, one per line</span>
          <LineList items={b.items.map((x) => x.word)} itemLabel="Word" addLabel="Add a word" placeholder="Haus"
            onChange={(words) => onChange({ items: words.map((word) => ({ word })) })} />
        </div>
      );
    case "gap":
      return <GapFields b={b} onChange={onChange} />;
    case "spell_name":
      return <p className="muted">Students type their name, see each letter's German name, and read the sentence „Ich heiße … Ich buchstabiere: …“. Nothing to fill in.</p>;
    case "video":
      return <Pick label="Video" value={b.video_id} items={options.videos} empty="You have no videos at this level yet. Add one under My videos." onChange={(v) => onChange({ video_id: v })} />;
    case "speaking":
      return <Pick label="Speaking task" value={b.task_id} items={options.speaking} empty="There are no speaking tasks at this level yet." onChange={(v) => onChange({ task_id: v })} />;
    default:
      return null;
  }
}

function Pick({ label, value, items, empty, onChange }) {
  const id = useId();
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Choose…</option>
        {items.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
      </select>
    </div>
  );
}

function TableFields({ b, onChange }) {
  const cols = b.headers.length;
  const setHeader = (c, v) => onChange({ headers: b.headers.map((h, i) => (i === c ? v : h)) });
  const setCell = (r, c, v) => onChange({ rows: b.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  return (
    <div className="editor-stack">
      <div className="table-edit-wrap">
        <table className="table-edit">
          <thead>
            <tr>
              {b.headers.map((h, c) => (
                <th key={c}>
                  <span className="th-cell">
                    <input type="text" aria-label={`Column title ${c + 1}`} value={h} placeholder="Column title" onChange={(e) => setHeader(c, e.target.value)} />
                    {cols > 1 && <button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove column ${c + 1}`}
                      onClick={() => onChange({ headers: b.headers.filter((_, i) => i !== c), rows: b.rows.map((r) => r.filter((_, i) => i !== c)) })}><Icon name="x" /></button>}
                  </span>
                </th>
              ))}
              <th aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {b.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}><input type="text" lang="de" aria-label={`Row ${r + 1}, column ${c + 1}`} value={cell} onChange={(e) => setCell(r, c, e.target.value)} /></td>
                ))}
                <td><button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove row ${r + 1}`} onClick={() => onChange({ rows: b.rows.filter((_, i) => i !== r) })}><Icon name="x" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button className="btn-dashed" type="button" onClick={() => onChange({ rows: [...b.rows, b.headers.map(() => "")] })}><Icon name="plus" />Row</button>
        <button className="btn-dashed" type="button" aria-disabled={cols >= 8}
          onClick={() => cols < 8 && onChange({ headers: [...b.headers, ""], rows: b.rows.map((r) => [...r, ""]) })}><Icon name="plus" />Column</button>
      </div>
    </div>
  );
}

function ChoiceFields({ b, onChange }) {
  const setItem = (i, v) => onChange({ items: b.items.map((x, j) => (j === i ? { ...x, ...v } : x)) });
  return (
    <div className="choice-items">
      {b.items.map((it, i) => (
        <fieldset key={i} className="choice-item">
          <legend>Question {i + 1}</legend>
          <div className="editor-grid-2">
            <div className="choice-say">
              <Input label="Plays aloud first (optional)" lang="de" value={it.say} maxLength={120} placeholder="e.g. E, or a word"
                onChange={(say) => setItem(i, { say })} />
              {it.say && <button className="icon-btn" type="button" aria-label="Listen" onClick={() => say(it.say)}><Icon name="say" /></button>}
            </div>
            <Input label="Question (optional if it plays a sound)" lang="de" value={it.prompt} placeholder="Wir ___ aus Indien." onChange={(prompt) => setItem(i, { prompt })} />
          </div>
          <span className="field-label">Answers: choose the right one</span>
          <div className="choice-options">
            {it.options.map((o, n) => (
              <div key={n} className="choice-option">
                <button type="button" className="right-pick" aria-pressed={it.answer === n} aria-label={`Answer ${n + 1} is right`}
                  onClick={() => setItem(i, { answer: n })}><Icon name="check" /></button>
                <input type="text" lang="de" aria-label={`Question ${i + 1}, answer ${n + 1}`} value={o} maxLength={200}
                  onChange={(e) => setItem(i, { options: it.options.map((x, m) => (m === n ? e.target.value : x)) })} />
                {it.options.length > 2 && (
                  <button className="icon-btn icon-btn-bad" type="button" aria-label={`Remove answer ${n + 1}`}
                    onClick={() => setItem(i, { options: it.options.filter((_, m) => m !== n), answer: it.answer === n ? 0 : it.answer > n ? it.answer - 1 : it.answer })}><Icon name="x" /></button>
                )}
              </div>
            ))}
            {it.options.length < 6 && <div><button className="btn-dashed" type="button" onClick={() => setItem(i, { options: [...it.options, ""] })}><Icon name="plus" />Answer</button></div>}
          </div>
          <Input label="Explanation after answering (optional)" value={it.explain} placeholder="wir sind: 1. Person Plural." onChange={(explain) => setItem(i, { explain })} />
          {b.items.length > 1 && (
            <div><button className="btn btn-quiet btn-small" type="button" onClick={() => onChange({ items: b.items.filter((_, j) => j !== i) })}><Icon name="trash" />Remove question {i + 1}</button></div>
          )}
        </fieldset>
      ))}
      <div><button className="btn-dashed" type="button" onClick={() => onChange({ items: [...b.items, { prompt: "", say: "", options: ["", ""], answer: 0, explain: "" }] })}><Icon name="plus" />Add a question</button></div>
    </div>
  );
}

function GapFields({ b, onChange }) {
  const choices = b.choices.filter((c) => c.trim());
  return (
    <>
      <TextArea label="Introduction (optional)" rows={2} value={b.intro} onChange={(intro) => onChange({ intro })} />
      <Input label="Choices, with commas" lang="de" value={b.choices.join(", ")} placeholder="ei, ie"
        onChange={(v) => onChange({ choices: v.split(",").map((x) => x.trim()) })} />
      <Rows rows={b.items} itemLabel="Word" addLabel="Add a word" blank={{ text: "", answer: "" }} onChange={(items) => onChange({ items })}
        columns={[
          { key: "text", label: "Word, with _ for the gap", lang: "de", placeholder: "sp_len" },
          { key: "answer", label: `Right choice${choices.length ? ` (${choices.join(" / ")})` : ""}`, lang: "de", placeholder: choices[0] || "ie", width: "1fr" },
        ]} />
    </>
  );
}

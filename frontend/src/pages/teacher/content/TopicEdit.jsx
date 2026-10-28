import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon";
import { useToast } from "../../../components/Toasts";
import { Async, Field, FormError, PageHead, SayButton } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { ARTICLES, DeleteBox, LevelSelect, backTo } from "./parts";

// ---------- new topic ----------
export function TopicNew() {
  useTitle("New topic");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ level: params.get("level") || "A1", name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    try {
      const res = await api("/teacher/content/topics/", { method: "POST", body: form });
      toast(res.message);
      navigate(`/teacher/content/topics/${res.topic.id}`, { replace: true });
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead crumb={backTo(form.level, "words")} title="New topic">
        <p className="muted">A topic is one word list, for example “Familie” or “Essen”. You add the words next.</p>
      </PageHead>
      <form className="panel form" onSubmit={create} noValidate>
        <FormError error={error} />
        <Field label="Topic name (German)" name="name" lang="de" errors={errors} autoFocus placeholder="e.g. Kleidung"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field label="Short description (English)" name="description" errors={errors} placeholder="e.g. Clothes" help="Optional. Shown under the name."
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <LevelSelect value={form.level} errors={errors} onChange={(level) => setForm({ ...form, level })} />
        <div className="actions"><button className="btn btn-primary" type="submit">Create topic</button></div>
      </form>
    </>
  );
}

// ---------- edit a topic and its words ----------
let keySeed = 0;
const newKey = () => `k${++keySeed}`;
const toRow = (w) => ({ ...w, key: newKey(), status: "saved", error: "", v: 0 });

export function TopicEdit() {
  const { id } = useParams();
  const state = useApi(`/teacher/content/topics/${id}/`);
  useTitle(state.data?.topic.name || "Topic");
  return <Async state={state}>{(d) => <TopicEditor key={d.topic.id} topic={d.topic} />}</Async>;
}

function TopicEditor({ topic: initial }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [head, setHead] = useState({ level: initial.level, name: initial.name, description: initial.description });
  const [saved, setSaved] = useState({ ...head, slug: initial.slug });
  const [headErrors, setHeadErrors] = useState({});
  const [headStatus, setHeadStatus] = useState("saved");
  const [rows, setRows] = useState(() => initial.words.map(toRow));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const inputs = useRef({});

  // ----- topic name / description / level: saved when you leave the field -----
  const saveHead = async (next = head) => {
    if (next.name === saved.name && next.description === saved.description && next.level === saved.level) return;
    setHeadStatus("saving");
    try {
      const res = await api(`/teacher/content/topics/${initial.id}/`, { method: "PATCH", body: next });
      setSaved({ level: res.topic.level, name: res.topic.name, description: res.topic.description, slug: res.topic.slug });
      setHeadErrors({});
      setHeadStatus("saved");
    } catch (err) {
      setHeadErrors(err.fieldErrors);
      setHeadStatus("error");
    }
  };

  // ----- words: each row saves itself when you leave it -----
  const patchRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const edit = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, status: "dirty", error: "", v: r.v + 1 } : r)));

  const saveRow = async (key, patch = {}) => {
    const current = rowsRef.current.find((r) => r.key === key);
    if (!current) return;
    const r = { ...current, ...patch };
    if (r.status !== "dirty" && !Object.keys(patch).length) return;
    if (!r.id && (!r.german.trim() || !r.english.trim())) {
      patchRow(key, { ...patch, status: "dirty", error: r.german.trim() || r.english.trim() ? "Add the German word and its meaning to save it." : "" });
      return;
    }
    const v = r.v + (Object.keys(patch).length ? 1 : 0);
    patchRow(key, { ...patch, status: "saving", error: "", v });
    const payload = { article: r.article, german: r.german, english: r.english, example: r.example };
    try {
      const res = r.id
        ? await api(`/teacher/content/words/${r.id}/`, { method: "PATCH", body: payload })
        : await api(`/teacher/content/topics/${initial.id}/words/`, { method: "POST", body: payload });
      const now = rowsRef.current.find((x) => x.key === key);
      if (!now) return;
      if (now.v === v) patchRow(key, { id: res.word.id, status: "saved" });
      else { patchRow(key, { id: res.word.id }); setTimeout(() => saveRow(key), 0); }
    } catch (err) {
      const first = Object.values(err.fieldErrors)[0]?.[0];
      patchRow(key, { status: "error", error: first || err.message });
    }
  };

  const removeRow = async (r) => {
    if (r.id) {
      try {
        await api(`/teacher/content/words/${r.id}/`, { method: "DELETE" });
      } catch (err) {
        toast(err.message, "error");
        return;
      }
    }
    setRows((rs) => rs.filter((x) => x.key !== r.key));
    if (r.german) toast(`“${[r.article, r.german].filter(Boolean).join(" ")}” deleted.`);
  };

  const addRow = () => {
    const row = { id: null, article: "", german: "", english: "", example: "", key: newKey(), status: "dirty", error: "", v: 0 };
    setRows((rs) => [...rs, row]);
    setTimeout(() => inputs.current[row.key]?.focus(), 0);
  };

  const leaveRow = (key) => (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) saveRow(key);
  };

  const statuses = rows.map((r) => r.status).concat(headStatus);
  const overall = statuses.includes("saving") ? ["saving", "Saving…"]
    : statuses.includes("error") ? ["error", "Some changes couldn't be saved. See the red notes below."]
    : rows.some((r) => r.status === "dirty" && (r.id || (r.german && r.english))) ? ["saving", "Unsaved changes"]
    : ["saved", "All changes saved"];

  const wordCount = rows.filter((r) => r.id).length;
  return (
    <>
      <PageHead crumb={backTo(saved.level, "words")} title={saved.name} lang="de" actions={
        <div className="actions">
          <Link className="btn btn-secondary" to={`/words/${saved.level}/${saved.slug}`}>Preview as student</Link>
        </div>
      }>
        <p className="muted">
          {saved.description ? `${saved.description} · ` : ""}{wordCount} {wordCount === 1 ? "word" : "words"} · {" "}
          <span className={`save-state save-${overall[0]}`} role="status">{overall[0] === "saved" && <Icon name="check" />}{overall[1]}</span>
        </p>
      </PageHead>

      <section className="panel editor-grid-3">
        <Field label="Topic name (German)" name="name" lang="de" errors={headErrors} value={head.name}
          onChange={(e) => setHead({ ...head, name: e.target.value })} onBlur={() => saveHead()} />
        <Field label="Short description (English)" name="description" errors={headErrors} value={head.description}
          onChange={(e) => setHead({ ...head, description: e.target.value })} onBlur={() => saveHead()} />
        <LevelSelect value={head.level} errors={headErrors} onChange={(level) => { const next = { ...head, level }; setHead(next); saveHead(next); }} />
      </section>

      <section className="panel word-table-wrap">
        <div className="word-table" role="table" aria-label="Words">
          <div className="word-row word-head" role="row">
            <span role="columnheader">Article</span><span role="columnheader">German</span><span role="columnheader">English</span>
            <span role="columnheader">Example sentence</span><span role="columnheader"><span className="visually-hidden">Actions</span></span>
          </div>
          {rows.map((r) => (
            <div key={r.key} className={`word-row${r.status === "error" ? " has-error" : ""}`} role="row" onBlur={leaveRow(r.key)}>
              <span className="art-pick" role="group" aria-label="Article">
                {ARTICLES.map((a) => (
                  <button key={a.value} type="button" className={`art-btn art-btn-${a.value || "none"}`} title={a.title}
                    aria-pressed={r.article === a.value} onClick={() => { edit(r.key, { article: a.value }); saveRow(r.key, { article: a.value }); }}>
                    {a.label}
                  </button>
                ))}
              </span>
              <input ref={(el) => (inputs.current[r.key] = el)} type="text" className="word-cell word-german" lang="de" aria-label="German word"
                placeholder="Wort" value={r.german} onChange={(e) => edit(r.key, { german: e.target.value })} />
              <input type="text" className="word-cell" aria-label="English meaning" placeholder="meaning"
                value={r.english} onChange={(e) => edit(r.key, { english: e.target.value })} />
              <input type="text" className="word-cell" lang="de" aria-label="Example sentence" placeholder="Optional"
                value={r.example} onChange={(e) => edit(r.key, { example: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && r.key === rows[rows.length - 1].key) { e.preventDefault(); addRow(); } }} />
              <span className="word-actions">
                {r.german && <SayButton text={[r.article, r.german].filter(Boolean).join(" ")} small />}
                <button className="icon-btn icon-btn-bad" type="button" aria-label={`Delete ${r.german || "this word"}`} onClick={() => removeRow(r)}><Icon name="trash" /></button>
              </span>
              {r.error && <p className="word-error" role="alert">{r.error}</p>}
            </div>
          ))}
          {!rows.length && <p className="muted" style={{ padding: "var(--s4) var(--s5)", margin: 0 }}>No words yet. Add the first one below, or paste a whole list.</p>}
        </div>
        <div style={{ padding: "var(--s4) var(--s5)" }}>
          <button className="btn btn-soft" type="button" onClick={addRow}><Icon name="plus" />Add a word</button>
        </div>
      </section>

      <BulkAdd topicId={initial.id} onAdded={(words) => setRows(words.map(toRow))} />

      <section className="section">
        <DeleteBox label="Delete this topic" onDelete={async () => {
          try {
            const res = await api(`/teacher/content/topics/${initial.id}/`, { method: "DELETE" });
            toast(res.message);
            navigate(backTo(saved.level, "words").to);
          } catch (err) { toast(err.message, "error"); }
        }}>
          “{saved.name}” and all {wordCount} of its words will be removed for every student, including their flashcard progress.
        </DeleteBox>
      </section>
    </>
  );
}

function BulkAdd({ topicId, onAdded }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [problems, setProblems] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!text) setProblems(null); }, [text]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await api(`/teacher/content/topics/${topicId}/import/`, { method: "POST", body: { text } });
      toast(res.message);
      onAdded(res.topic.words);
      setText("");
    } catch (err) {
      setProblems({ message: err.message, lines: err.data?.lines || [] });
    }
    setBusy(false);
  };

  return (
    <form className="panel section bulk" onSubmit={submit} noValidate>
      <h2>Add many words at once</h2>
      <p className="muted">One word per line: article; word; meaning; example. The article and example are optional. You can also copy rows straight from Excel.</p>
      <label className="visually-hidden" htmlFor="bulk-words">Words to add</label>
      <textarea id="bulk-words" lang="de" rows={5} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"die; Tante; the aunt; Meine Tante wohnt in Köln.\nder; Onkel; the uncle"} />
      {problems && (
        <div className="form-errors" role="alert">
          <p>{problems.message}</p>
          {problems.lines.length > 0 && <ul>{problems.lines.map((l, i) => <li key={i}>{l.line ? `Line ${l.line}: ` : ""}{l.message}</li>)}</ul>}
        </div>
      )}
      <div className="actions"><button className="btn btn-primary" type="submit" aria-disabled={busy}>Check and add</button></div>
    </form>
  );
}

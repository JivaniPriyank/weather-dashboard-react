import { useId, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon";
import { useToast } from "../../../components/Toasts";
import { Async, FormError, PageHead } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { DeleteBox, FieldError, LevelSelect, backTo } from "./parts";

export default function GrammarEdit() {
  const { id } = useParams();
  const state = useApi(id ? `/teacher/content/grammar/${id}/` : null);
  useTitle(state.data?.topic.title || "New grammar topic");
  if (!id) return <GrammarForm key="new" />;
  return <Async state={state}>{(d) => <GrammarForm key={d.topic.id} initial={d.topic} />}</Async>;
}

let seed = 0;
const k = () => `g${++seed}`;

function GrammarForm({ initial }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const ids = { title: useId(), rule: useId() };
  const [form, setForm] = useState(() => ({
    level: initial?.level || params.get("level") || "A1",
    title: initial?.title || "",
    rule: initial?.rule || "",
  }));
  const [headers, setHeaders] = useState(() => initial?.table.headers || []);
  const [rows, setRows] = useState(() => (initial?.table.rows || []).map((cells) => ({ key: k(), cells })));
  const [examples, setExamples] = useState(() => (initial?.examples.length ? initial.examples : [{ german: "", english: "" }]).map((e) => ({ ...e, key: k() })));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const setCell = (rk, c, v) => setRows(rows.map((r) => (r.key === rk ? { ...r, cells: r.cells.map((x, i) => (i === c ? v : x)) } : r)));
  const addRow = () => setRows([...rows, { key: k(), cells: headers.map(() => "") }]);
  const addCol = () => { if (headers.length >= 8) return; setHeaders([...headers, ""]); setRows(rows.map((r) => ({ ...r, cells: [...r.cells, ""] }))); };
  const removeCol = (c) => {
    if (headers.length === 1) { setHeaders([]); setRows([]); return; }
    setHeaders(headers.filter((_, i) => i !== c));
    setRows(rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== c) })));
  };
  const startTable = () => { setHeaders(["Person", ""]); setRows(["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"].map((p) => ({ key: k(), cells: [p, ""] }))); };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload = { ...form, table: { headers, rows: rows.map((r) => r.cells) }, examples: examples.map(({ german, english }) => ({ german, english })) };
    try {
      const res = initial
        ? await api(`/teacher/content/grammar/${initial.id}/`, { method: "PUT", body: payload })
        : await api("/teacher/content/grammar/", { method: "POST", body: payload });
      toast(res.message);
      navigate(backTo(res.topic.level, "grammar").to);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <PageHead crumb={backTo(form.level, "grammar")} title={initial ? initial.title : "New grammar topic"} actions={
        <div className="actions">
          {initial && <Link className="btn btn-secondary" to={`/grammar/${initial.level}/${initial.slug}`}>Preview as student</Link>}
          <button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save topic"}</button>
        </div>
      }>
        {initial && <p className="muted">{initial.questions} quiz question{initial.questions === 1 ? "" : "s"} use this topic</p>}
      </PageHead>
      <FormError error={error} />

      <section className="panel editor-stack">
        <div className="editor-grid-2-1">
          <div className={`field${errors.title ? " has-error" : ""}`}>
            <label htmlFor={ids.title}>Title</label>
            <input id={ids.title} type="text" value={form.title} placeholder="e.g. Modalverben: können, müssen, wollen"
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <FieldError errors={errors} name="title" />
          </div>
          <LevelSelect value={form.level} errors={errors} onChange={(level) => setForm({ ...form, level })} />
        </div>
        <div className={`field${errors.rule ? " has-error" : ""}`}>
          <label htmlFor={ids.rule}>The rule, in plain words</label>
          <textarea id={ids.rule} rows={4} value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })} />
          <FieldError errors={errors} name="rule" />
        </div>
      </section>

      <section className="panel section editor-stack">
        <div className="editor-head">
          <div>
            <h2>Table</h2>
            <p className="muted">Click any cell to type. The first row is the heading. Empty rows are left out.</p>
          </div>
          {headers.length > 0 && (
            <div className="actions">
              <button className="btn-dashed" type="button" onClick={addRow}><Icon name="plus" />Row</button>
              <button className="btn-dashed" type="button" onClick={addCol} aria-disabled={headers.length >= 8}><Icon name="plus" />Column</button>
            </div>
          )}
        </div>
        {headers.length ? (
          <div className="table-edit-wrap">
            <table className="table-edit">
              <thead>
                <tr>
                  {headers.map((h, c) => (
                    <th key={c}>
                      <span className="th-cell">
                        <input type="text" aria-label={`Heading ${c + 1}`} value={h} placeholder="Heading"
                          onChange={(e) => setHeaders(headers.map((x, i) => (i === c ? e.target.value : x)))} />
                        <button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove column ${c + 1}`} onClick={() => removeCol(c)}><Icon name="x" /></button>
                      </span>
                    </th>
                  ))}
                  <th aria-hidden="true" style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.key}>
                    {r.cells.map((cell, c) => (
                      <td key={c}>
                        <input type="text" lang="de" aria-label={`Row ${ri + 1}, ${headers[c] || `column ${c + 1}`}`} value={cell}
                          className={c === 0 ? "first-col" : ""} onChange={(e) => setCell(r.key, c, e.target.value)} />
                      </td>
                    ))}
                    <td><button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove row ${ri + 1}`} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Icon name="x" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div><button className="btn btn-soft" type="button" onClick={startTable}><Icon name="plus" />Add a table</button></div>
        )}
        <FieldError errors={errors} name="table" />
      </section>

      <section className="panel section editor-stack">
        <h2>Examples</h2>
        {examples.map((ex, i) => (
          <div key={ex.key} className="example-edit">
            <input type="text" lang="de" aria-label={`Example ${i + 1} in German`} placeholder="German sentence" value={ex.german}
              onChange={(e) => setExamples(examples.map((x) => (x.key === ex.key ? { ...x, german: e.target.value } : x)))} />
            <input type="text" aria-label={`Example ${i + 1} in English`} placeholder="English translation" value={ex.english}
              onChange={(e) => setExamples(examples.map((x) => (x.key === ex.key ? { ...x, english: e.target.value } : x)))} />
            <button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove example ${i + 1}`} onClick={() => setExamples(examples.filter((x) => x.key !== ex.key))}><Icon name="x" /></button>
          </div>
        ))}
        <FieldError errors={errors} name="examples" />
        <div><button className="btn-dashed" type="button" onClick={() => setExamples([...examples, { german: "", english: "", key: k() }])}><Icon name="plus" />Add an example</button></div>
      </section>

      {initial && (
        <section className="section">
          <DeleteBox label="Delete this grammar topic" onDelete={async () => {
            try {
              const res = await api(`/teacher/content/grammar/${initial.id}/`, { method: "DELETE" });
              toast(res.message);
              navigate(backTo(form.level, "grammar").to);
            } catch (err) { toast(err.message, "error"); }
          }}>
            Its quiz questions and videos are kept, just no longer linked to a grammar topic.
          </DeleteBox>
        </section>
      )}
    </form>
  );
}

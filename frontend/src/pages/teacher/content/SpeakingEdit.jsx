import { useId, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "../../../components/Toasts";
import { Async, FormError, PageHead } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { DeleteBox, FieldError, LevelSelect, LineList, backTo } from "./parts";

export default function SpeakingEdit() {
  const { id } = useParams();
  const options = useApi("/teacher/content/speaking/options/");
  const task = useApi(id ? `/teacher/content/speaking/${id}/` : null);
  useTitle(task.data?.task.title || (id ? "Speaking task" : "New speaking task"));
  if (id && (task.loading || task.error)) return <Async state={task}>{() => null}</Async>;
  return <Async state={options}>{(o) => <SpeakingForm key={id || "new"} parts={o.parts} initial={task.data?.task} />}</Async>;
}

function SpeakingForm({ parts, initial }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const ids = { title: useId(), part: useId(), brief: useId(), prompt: useId(), model: useId() };
  const [form, setForm] = useState(() => initial
    ? { ...initial }
    : { level: params.get("level") || "A1", part: parts[0].value, title: "", brief: "", prompt: "", minutes: 4, model_answer: "",
        questions: [""], phrases: [""] });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const field = (name) => `field${errors[name] ? " has-error" : ""}`;

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { level, part, title, brief, prompt, minutes, model_answer, questions, phrases } = form;
    const payload = { level, part, title, brief, prompt, minutes, model_answer, questions, phrases };
    try {
      const res = initial
        ? await api(`/teacher/content/speaking/${initial.id}/`, { method: "PUT", body: payload })
        : await api("/teacher/content/speaking/", { method: "POST", body: payload });
      toast(res.message);
      navigate(backTo(res.task.level, "speaking").to);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
      setBusy(false);
    }
  };

  const n = initial?.submissions || 0;
  return (
    <form onSubmit={save} noValidate>
      <PageHead crumb={backTo(form.level, "speaking")} title={initial ? initial.title : "New speaking task"} lang="de" actions={
        <div className="actions">
          {initial && <Link className="btn btn-secondary" to={`/speaking/${initial.level}/${initial.slug}`}>Preview as student</Link>}
          <button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save task"}</button>
        </div>
      } />
      <FormError error={error} />

      <section className="panel editor-stack">
        <div className="editor-grid-speaking">
          <div className={field("title")}>
            <label htmlFor={ids.title}>Title (German)</label>
            <input id={ids.title} type="text" lang="de" value={form.title} placeholder="e.g. Im Restaurant" onChange={(e) => set({ title: e.target.value })} />
            <FieldError errors={errors} name="title" />
          </div>
          <LevelSelect value={form.level} errors={errors} onChange={(level) => set({ level })} />
          <div className={field("part")}>
            <label htmlFor={ids.part}>Exam part</label>
            <select id={ids.part} value={form.part} onChange={(e) => set({ part: e.target.value })}>
              {parts.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <FieldError errors={errors} name="part" />
          </div>
          <div className={field("minutes")}>
            <span className="label-like" id="minutes-label">Speaking time</span>
            <div className="stepper" role="group" aria-labelledby="minutes-label">
              <button type="button" aria-label="One minute less" onClick={() => set({ minutes: Math.max(1, form.minutes - 1) })}>−</button>
              <output aria-live="polite">{form.minutes} min</output>
              <button type="button" aria-label="One minute more" onClick={() => set({ minutes: Math.min(15, form.minutes + 1) })}>+</button>
            </div>
            <FieldError errors={errors} name="minutes" />
          </div>
        </div>
        <div className={field("brief")}>
          <label htmlFor={ids.brief}>What the student has to do (English)</label>
          <input id={ids.brief} type="text" value={form.brief} placeholder="e.g. Order food and ask for the bill." onChange={(e) => set({ brief: e.target.value })} />
          <FieldError errors={errors} name="brief" />
        </div>
        <div className={field("prompt")}>
          <label htmlFor={ids.prompt}>The exam task (German)</label>
          <textarea id={ids.prompt} lang="de" rows={3} value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} />
          <FieldError errors={errors} name="prompt" />
        </div>
      </section>

      <div className="editor-two-lists section">
        <section className="panel editor-stack">
          <h2>Questions to answer <span className="muted line-count">{form.questions.filter((x) => x.trim()).length}</span></h2>
          <LineList items={form.questions} onChange={(questions) => set({ questions })} addLabel="Add a question" itemLabel="Question" placeholder="e.g. Was möchten Sie trinken?" />
          <FieldError errors={errors} name="questions" />
        </section>
        <section className="panel editor-stack">
          <h2>Useful phrases <span className="muted line-count">{form.phrases.filter((x) => x.trim()).length}</span></h2>
          <LineList items={form.phrases} onChange={(phrases) => set({ phrases })} addLabel="Add a phrase" itemLabel="Phrase" placeholder="e.g. Ich hätte gern …" />
          <FieldError errors={errors} name="phrases" />
        </section>
      </div>

      <section className="panel section editor-stack">
        <div className={field("model_answer")}>
          <label htmlFor={ids.model}><span className="h2-like">Model answer</span></label>
          <p className="help">Students see this only after they've practised or sent their answer.</p>
          <textarea id={ids.model} lang="de" rows={5} value={form.model_answer} onChange={(e) => set({ model_answer: e.target.value })} />
          <FieldError errors={errors} name="model_answer" />
        </div>
      </section>

      {initial && (
        <section className="section">
          <DeleteBox label="Delete this speaking task" onDelete={async () => {
            try {
              const res = await api(`/teacher/content/speaking/${initial.id}/`, { method: "DELETE" });
              toast(res.message);
              navigate(backTo(form.level, "speaking").to);
            } catch (err) { toast(err.message, "error"); }
          }}>
            {n ? `${n} recorded answer${n === 1 ? "" : "s"} from students, with your feedback, will be deleted too.` : "No student has sent an answer to it yet."}
          </DeleteBox>
        </section>
      )}
    </form>
  );
}

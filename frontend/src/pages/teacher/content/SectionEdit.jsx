import { useId, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon, { SECTION_ICONS } from "../../../components/Icon";
import { useToast } from "../../../components/Toasts";
import { Async, FormError, PageHead } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { useSession } from "../../../lib/session";
import { DeleteBox, FieldError, LevelSelect, backTo } from "./parts";

const ICON_LABELS = { star: "Star", book: "Book", chat: "Speech bubble", headphones: "Headphones", bulb: "Light bulb", flag: "Flag", globe: "Globe", pencil: "Pencil" };

function IconPicker({ value, onChange }) {
  return (
    <fieldset className="field icon-picker">
      <legend>Icon</legend>
      <div className="icon-picker-row">
        {SECTION_ICONS.map((name) => (
          <button key={name} type="button" className="icon-choice" aria-pressed={value === name} aria-label={ICON_LABELS[name]}
            title={ICON_LABELS[name]} onClick={() => onChange(name)}>
            <Icon name={name} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// The name, level, icon, description and visibility of a section.
function SettingsFields({ form, setForm, errors, showVisible, topics }) {
  const ids = { title: useId(), description: useId(), visible: useId(), topic: useId(), homework: useId() };
  return (
    <>
      <div className={`field${errors.title ? " has-error" : ""}`}>
        <label htmlFor={ids.title}>Name, as students see it in their menu</label>
        <input id={ids.title} type="text" value={form.title} maxLength={80} placeholder="e.g. Basics of A1, Exam tips"
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <FieldError errors={errors} name="title" />
      </div>
      <LevelSelect value={form.level} errors={errors} onChange={(level) => setForm({ ...form, level })} />
      <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
      <div className={`field${errors.description ? " has-error" : ""}`}>
        <label htmlFor={ids.description}>Short description <span className="muted">(optional)</span></label>
        <input id={ids.description} type="text" value={form.description} maxLength={200} placeholder="One line under the name"
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <FieldError errors={errors} name="description" />
      </div>
      {topics && (
        <>
          <GoalsField goals={form.goals} errors={errors} onChange={(goals) => setForm({ ...form, goals })} />
          <div className={`field${errors.topic ? " has-error" : ""}`}>
            <label htmlFor={ids.topic}>Word list of this section</label>
            <select id={ids.topic} value={form.topic ?? ""} onChange={(e) => setForm({ ...form, topic: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">None</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="help">Students find a link to it on the section page. Make lists under Content → Words.</p>
            <FieldError errors={errors} name="topic" />
          </div>
          <div className={`field${errors.homework ? " has-error" : ""}`}>
            <label htmlFor={ids.homework}>Homework <span className="muted">(optional)</span></label>
            <textarea id={ids.homework} rows={4} value={form.homework || ""} onChange={(e) => setForm({ ...form, homework: e.target.value })} />
            <p className="help">A blank line starts a new paragraph.</p>
            <FieldError errors={errors} name="homework" />
          </div>
        </>
      )}
      {showVisible && (
        <label className="check" htmlFor={ids.visible}>
          <input id={ids.visible} type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} />
          Students can see this section
        </label>
      )}
    </>
  );
}

// "What you'll learn": up to 8 short goals, each a title and one line.
function GoalsField({ goals = [], errors, onChange }) {
  const set = (i, k, v) => onChange(goals.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  return (
    <fieldset className="field goals-edit">
      <legend>Learning goals <span className="muted">(optional)</span></legend>
      {goals.map((g, i) => (
        <div className="goal-edit" key={i}>
          <span className="goal-edit-num">{i + 1}</span>
          <input type="text" aria-label={`Goal ${i + 1}: title`} placeholder="Numbers 0–100" value={g.title} maxLength={80} onChange={(e) => set(i, "title", e.target.value)} />
          <input type="text" aria-label={`Goal ${i + 1}: description`} placeholder="Count and combine numbers" value={g.text} maxLength={200} onChange={(e) => set(i, "text", e.target.value)} />
          <button className="icon-btn icon-btn-bad" type="button" aria-label={`Remove goal ${i + 1}`} onClick={() => onChange(goals.filter((_, j) => j !== i))}><Icon name="x" /></button>
        </div>
      ))}
      {goals.length < 8 && <div><button className="btn-dashed" type="button" onClick={() => onChange([...goals, { title: "", text: "" }])}><Icon name="plus" />Add a goal</button></div>}
      <FieldError errors={errors} name="goals" />
    </fieldset>
  );
}

export function SectionNew() {
  useTitle("New section");
  const [params] = useSearchParams();
  const { current_level } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", description: "", icon: "star", is_visible: true, level: params.get("level") || current_level?.code || "A1" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await api("/teacher/content/sections/", { method: "POST", body: form });
      toast(res.message);
      navigate(`/teacher/content/sections/${res.section.id}`);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} noValidate>
      <PageHead crumb={backTo(form.level, "sections")} title="New section">
        <p className="muted">A section is a group of lessons, like a chapter. Students find it in their menu.</p>
      </PageHead>
      <FormError error={error} />
      <section className="panel editor-stack section-form">
        <SettingsFields form={form} setForm={setForm} errors={errors} />
        <div><button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Creating…" : "Create section"}</button></div>
      </section>
    </form>
  );
}

export function SectionEdit() {
  const { id } = useParams();
  const state = useApi(`/teacher/content/sections/${id}/`);
  useTitle(state.data?.section.title);
  return <Async state={state}>{(d) => <SectionPage key={d.section.id} data={d} reload={state.reload} setData={state.setData} />}</Async>;
}

function SectionPage({ data, setData }) {
  const { section, topics } = data;
  const navigate = useNavigate();
  const toast = useToast();
  const newId = useId();
  const [form, setForm] = useState({
    title: section.title, description: section.description, icon: section.icon, level: section.level, is_visible: section.is_visible,
    goals: section.goals || [], homework: section.homework || "", topic: section.topic?.id ?? "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newErrors, setNewErrors] = useState({});

  const update = (sec) => setData((d) => ({ ...d, section: sec }));

  const saveSettings = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await api(`/teacher/content/sections/${section.id}/`, { method: "PATCH", body: form });
      update(res.section);
      setErrors({});
      toast("Section saved.");
    } catch (err) {
      setErrors(err.fieldErrors);
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addLesson = async (e) => {
    e.preventDefault();
    try {
      const res = await api(`/teacher/content/sections/${section.id}/lessons/`, { method: "POST", body: { title: newTitle } });
      toast(res.message);
      navigate(`/teacher/content/lessons/${res.lesson.id}`);
    } catch (err) {
      setNewErrors(err.fieldErrors);
    }
  };

  const move = async (i, dir) => {
    const ids = section.lessons.map((l) => l.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    try {
      const res = await api(`/teacher/content/sections/${section.id}/order/`, { method: "POST", body: { lessons: ids } });
      update(res.section);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const remove = async () => {
    const res = await api(`/teacher/content/sections/${section.id}/`, { method: "DELETE" });
    toast(res.message);
    navigate(backTo(section.level, "sections").to);
  };

  const published = section.lessons.filter((l) => l.is_published).length;
  return (
    <>
      <PageHead crumb={backTo(section.level, "sections")} title={<span className="section-title"><span className="section-title-icon"><Icon name={section.icon} /></span>{section.title}</span>}>
        <p className="muted">
          {section.level} · {section.lessons.length} lesson{section.lessons.length === 1 ? "" : "s"}, {published} published ·{" "}
          {section.is_visible ? `shown in the menu of ${section.level} students` : "hidden from students"}
        </p>
      </PageHead>

      <div className="section-layout">
        <section className="panel section-lessons">
          <div className="editor-head">
            <div>
              <h2>Lessons</h2>
              <p className="muted">Students see them in this order. Drafts stay hidden until you publish them.</p>
            </div>
          </div>
          {section.lessons.length ? (
            <ol className="section-lesson-list">
              {section.lessons.map((l, i) => (
                <li key={l.id} className="section-lesson">
                  <span className="section-lesson-num">{i + 1}</span>
                  <Link className="section-lesson-main" to={`/teacher/content/lessons/${l.id}`}>
                    <b lang="de">{l.title}</b>
                    <span className="muted small">{l.summary || "Empty"}{l.exercises ? ` · ${l.exercises} answers` : ""}</span>
                  </Link>
                  <span className={`badge ${l.is_published ? "badge-good" : "badge-note"}`}>{l.is_published ? "Published" : "Draft"}</span>
                  <span className="section-lesson-move">
                    <button className="icon-btn" type="button" aria-label={`Move “${l.title}” up`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" /></button>
                    <button className="icon-btn" type="button" aria-label={`Move “${l.title}” down`} disabled={i === section.lessons.length - 1} onClick={() => move(i, 1)}><Icon name="down" /></button>
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="muted">No lessons yet. Add the first one below.</p>}
          <form className="section-new-lesson" onSubmit={addLesson} noValidate>
            <div className={`field${newErrors.title ? " has-error" : ""}`}>
              <label htmlFor={newId}>New lesson</label>
              <input id={newId} type="text" lang="de" value={newTitle} maxLength={120} placeholder="e.g. Personalpronomen und „sein“"
                onChange={(e) => setNewTitle(e.target.value)} />
              <FieldError errors={newErrors} name="title" />
            </div>
            <button className="btn btn-primary" type="submit"><Icon name="plus" />Add lesson</button>
          </form>
        </section>

        <form className="panel editor-stack section-settings" onSubmit={saveSettings} noValidate>
          <h2>Section settings</h2>
          <SettingsFields form={form} setForm={setForm} errors={errors} showVisible topics={topics} />
          <div className="actions">
            <button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <Link className="btn btn-secondary" to={`/sections/${section.id}`}>Preview as student</Link>
          </div>
          <DeleteBox label="Delete this section" onDelete={remove}>
            This deletes “{section.title}”, its {section.lessons.length} lesson{section.lessons.length === 1 ? "" : "s"} and your students' progress in them.
          </DeleteBox>
        </form>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../components/Toasts";
import { Async, Empty, Field, PageHead, RowLink } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export function Classes() {
  useTitle("Classes");
  const state = useApi("/teacher/classes/");
  const toast = useToast();
  const { levels } = useSession();
  const [form, setForm] = useState({ name: "", level: "", description: "" });
  const [errors, setErrors] = useState({});

  const create = async (e) => {
    e.preventDefault();
    try {
      const res = await api("/teacher/classes/", { method: "POST", body: form });
      toast(res.message);
      setForm({ name: "", level: "", description: "" });
      setErrors({});
      state.reload();
    } catch (err) {
      setErrors(err.fieldErrors);
    }
  };

  return (
    <>
      <PageHead title="Classes"><p className="muted">Group your students. You can show a video to one class only.</p></PageHead>
      <div className="split">
        <div>
          <Async state={state}>
            {({ classes }) => classes.length ? (
              <ul className="list">
                {classes.map((c) => (
                  <RowLink key={c.id} to={`/teacher/classes/${c.id}`} title={c.name}
                    sub={`${c.level ? `${c.level} · ` : "No level yet · "}${c.students} student${c.students === 1 ? "" : "s"}${c.videos ? `, ${c.videos} video${c.videos === 1 ? "" : "s"}` : ""}${c.description ? `. ${c.description}` : ""}`} />
                ))}
              </ul>
            ) : <Empty title="No classes yet">Create one for each group you teach, for example “Tuesday A1”.</Empty>}
          </Async>
        </div>
        <aside className="panel">
          <h2 className="mb-4">New class</h2>
          <form className="form" onSubmit={create} noValidate>
            <Field label="Class name" name="name" errors={errors} placeholder="e.g. Tuesday A1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field as="select" label="Level" name="level" errors={errors} help="Only students of this level can join the class."
              value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="">Choose a level</option>
              {levels.map((lv) => <option key={lv.code} value={lv.code}>{lv.code} {lv.name}</option>)}
            </Field>
            <Field label="Description (optional)" name="description" errors={errors} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="btn btn-primary" type="submit">Create class</button>
          </form>
        </aside>
      </div>
    </>
  );
}

export function ClassEdit() {
  const { id } = useParams();
  const state = useApi(`/teacher/classes/${id}/`);
  const toast = useToast();
  const navigate = useNavigate();
  const { levels } = useSession();
  const [form, setForm] = useState({ name: "", level: "", description: "" });
  const [errors, setErrors] = useState({});
  useTitle(state.data?.classroom.name);
  useEffect(() => { if (state.data) setForm({ name: state.data.classroom.name, level: state.data.classroom.level || "", description: state.data.classroom.description }); }, [state.data]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api(`/teacher/classes/${id}/`, { method: "PATCH", body: form });
      toast("Class saved.");
      navigate("/teacher/classes");
    } catch (err) {
      setErrors(err.fieldErrors);
    }
  };
  const remove = async () => {
    try {
      const res = await api(`/teacher/classes/${id}/`, { method: "DELETE" });
      toast(res.message);
      navigate("/teacher/classes");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <Async state={state}>
      {({ classroom }) => (
        <>
          <PageHead crumb={{ to: "/teacher/classes", label: "Classes" }} title={classroom.name}>
            <p className="muted">{classroom.level ? `${classroom.level} class` : "This class has no level yet. Choose one so you can put students in it."}</p>
          </PageHead>
          <div className="split">
            <div>
              <h2 className="mb-4">Students in this class</h2>
              {classroom.students.length ? (
                <ul className="list">{classroom.students.map((s) => <RowLink key={s.id} to={`/teacher/students/${s.id}`} title={s.full_name} sub={s.email} />)}</ul>
              ) : <p className="muted">No students yet. Choose this class when you approve a request, or from a student's page.</p>}
            </div>
            <aside className="panel">
              <form className="form" onSubmit={save} noValidate>
                <Field label="Class name" name="name" errors={errors} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Field as="select" label="Level" name="level" errors={errors} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  <option value="">Choose a level</option>
                  {levels.map((lv) => <option key={lv.code} value={lv.code}>{lv.code} {lv.name}</option>)}
                </Field>
                <Field label="Description (optional)" name="description" errors={errors} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <button className="btn btn-primary" type="submit">Save</button>
              </form>
              <details className="danger mt-5">
                <summary>Delete class</summary>
                <p>The students stay, just without a class. Videos for this class become visible to everyone.</p>
                <button className="btn btn-danger btn-small" type="button" onClick={remove}>Delete “{classroom.name}”</button>
              </details>
            </aside>
          </div>
        </>
      )}
    </Async>
  );
}

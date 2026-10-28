import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { Async, Checkbox, Empty, Field, FormError, Loading, PageHead } from "../../components/ui";
import { api, upload } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";

export function TeacherVideos() {
  useTitle("My videos");
  const state = useApi("/teacher/videos/");
  return (
    <>
      <PageHead title="My videos" actions={<Link className="btn btn-primary" to="/teacher/videos/new"><Icon name="upload" />Add a video</Link>}>
        <p className="muted">Upload lessons or link YouTube and Vimeo videos. Only approved students can watch them.</p>
      </PageHead>
      <Async state={state}>
        {({ videos }) => videos.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Title</th><th scope="col">Shown to</th><th scope="col">Type</th><th scope="col">Watched by</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td><Link to={`/videos/${v.id}`}><b>{v.title}</b></Link>{!v.is_published && <> <span className="badge badge-note">Hidden</span></>}<br />
                      <span className="muted small">{v.level ? `${v.level}${v.grammar_topic ? ` · ${v.grammar_topic.title}` : ""}` : ""}</span>
                      {!v.level && <span className="badge badge-note">No level, students can't see this</span>}</td>
                    <td>{v.classroom || (v.level ? `All ${v.level} students` : "Nobody yet")}</td>
                    <td>{v.kind === "file" ? "Upload" : "Link"}</td>
                    <td>{v.watched_by} student{v.watched_by === 1 ? "" : "s"}</td>
                    <td><Link to={`/teacher/videos/${v.id}`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No videos yet" action={<Link className="btn btn-primary" to="/teacher/videos/new">Add your first video</Link>}>
            Record a short lesson on your phone and upload it, or paste a YouTube link.
          </Empty>
        )}
      </Async>
    </>
  );
}

const EMPTY = { title: "", description: "", source: "file", external_url: "", level: "", grammar_topic: "", classroom: "", is_published: true };

export function VideoEdit() {
  const { id } = useParams();
  const isNew = !id;
  useTitle(isNew ? "Add a video" : "Edit video");
  const options = useApi("/teacher/videos/options/");
  const existing = useApi(isNew ? null : `/teacher/videos/${id}/`);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  useEffect(() => {
    const v = existing.data?.video;
    if (v) setForm({ title: v.title, description: v.description || "", source: v.kind, external_url: v.external_url || "",
      level: v.level_id || "", grammar_topic: v.grammar_topic_id || "", classroom: v.classroom_id || "", is_published: v.is_published });
  }, [existing.data]);

  const submit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    for (const [k, v] of Object.entries(form)) {
      if (k === "is_published") { if (v) data.append(k, "on"); }
      else data.append(k, v ?? "");
    }
    if (form.source === "file" && file) data.append("file", file);
    setError(null);
    setProgress(0);
    try {
      const res = await upload(isNew ? "/teacher/videos/new/" : `/teacher/videos/${id}/`, data, setProgress);
      toast(res.message);
      navigate("/teacher/videos");
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.data?.errors?.__all__?.join(" ") || err.message);
      setProgress(null);
    }
  };

  const remove = async () => {
    try {
      const res = await api(`/teacher/videos/${id}/`, { method: "DELETE" });
      toast(res.message);
      navigate("/teacher/videos");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  if (options.loading || existing.loading) return <Loading />;
  const opts = options.data;
  const v = existing.data?.video;
  const levelCode = opts.levels.find((l) => String(l.id) === String(form.level))?.code;
  const topics = opts.grammar_topics.filter((g) => levelCode && g.level === levelCode);
  const classes = opts.classrooms.filter((c) => levelCode && c.level === levelCode);
  // a new level: drop a grammar topic or class that belongs to another level
  const chooseLevel = (e) => {
    const code = opts.levels.find((l) => String(l.id) === e.target.value)?.code;
    setForm((f) => ({
      ...f, level: e.target.value,
      grammar_topic: opts.grammar_topics.some((g) => String(g.id) === String(f.grammar_topic) && g.level === code) ? f.grammar_topic : "",
      classroom: opts.classrooms.some((c) => String(c.id) === String(f.classroom) && c.level === code) ? f.classroom : "",
    }));
  };

  return (
    <>
      <PageHead crumb={{ to: "/teacher/videos", label: "My videos" }} title={isNew ? "Add a video" : `Edit “${v.title}”`} />
      <div className="panel">
        <form className="form" onSubmit={submit} noValidate>
          <FormError error={error} />
          <Field label="Title" name="title" errors={errors} value={form.title} onChange={set("title")} />
          <Field as="textarea" rows={3} label="What's in the video (optional)" name="description" errors={errors} value={form.description} onChange={set("description")} />
          <fieldset className="field">
            <legend>Where is the video?</legend>
            <div className="choice-list">
              <label><input type="radio" name="source" value="file" checked={form.source === "file"} onChange={set("source")} /> Upload a video file</label>
              <label><input type="radio" name="source" value="link" checked={form.source === "link"} onChange={set("source")} /> Paste a YouTube or Vimeo link</label>
            </div>
          </fieldset>
          {form.source === "file" ? (
            <div>
              {v?.file_name && <p className="small muted">Current file: {v.file_name}. Choose a new file only to replace it.</p>}
              <div className={`field${errors.file ? " has-error" : ""}`}>
                <label htmlFor="video-file">Video file</label>
                <input id="video-file" type="file" accept="video/mp4,video/webm,video/quicktime,.m4v" onChange={(e) => setFile(e.target.files[0] || null)} />
                <p className="help">MP4 or WebM works in every browser.</p>
                {errors.file && <p className="error">{errors.file.join(" ")}</p>}
              </div>
            </div>
          ) : (
            <Field label="Video link" name="external_url" type="url" errors={errors} placeholder="https://www.youtube.com/watch?v=…" value={form.external_url} onChange={set("external_url")} />
          )}
          <Field as="select" label="Level" name="level" errors={errors} value={form.level} onChange={chooseLevel}
            help="Students only see videos of their own level.">
            <option value="">Choose a level</option>
            {opts.levels.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </Field>
          <Field as="select" label="Grammar topic (optional)" name="grammar_topic" errors={errors} value={form.grammar_topic} onChange={set("grammar_topic")}>
            <option value="">None</option>
            {topics.map((g) => <option key={g.id} value={g.id}>{g.level}: {g.title}</option>)}
          </Field>
          <Field as="select" label="Only for this class" name="classroom" errors={errors} value={form.classroom} onChange={set("classroom")}>
            <option value="">Every student</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Checkbox label="Students can see this video" checked={form.is_published} onChange={set("is_published")} />
          <div className="actions">
            <button className="btn btn-primary" type="submit" aria-disabled={progress !== null}>{progress !== null ? `Uploading… ${progress}%` : isNew ? "Add video" : "Save changes"}</button>
            <Link className="btn btn-quiet" to="/teacher/videos">Cancel</Link>
          </div>
          {progress !== null && form.source === "file" && file && (
            <div className="meter" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          )}
        </form>
        {!isNew && (
          <details className="danger" style={{ marginTop: "var(--s5)" }}>
            <summary>Delete video</summary>
            <p>This removes the video{v.kind === "file" ? " file" : ""} and who watched it. It can't be undone.</p>
            <button className="btn btn-danger btn-small" type="button" onClick={remove}>Delete video</button>
          </details>
        )}
      </div>
    </>
  );
}

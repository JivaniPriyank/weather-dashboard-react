import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { Async, Checkbox, Field, PageHead, scoreClass } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { useReloadWhileOpen } from "../../lib/live";
import { formatDate, plural } from "../../lib/speech";

const ACTIVITY_ICON = { words: "words", quiz: "practice", speaking: "speaking", answer: "speaking", video: "videos" };

export default function StudentDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const level = params.get("level") || "";
  const state = useApi(`/teacher/students/${id}/${level ? `?level=${level}` : ""}`);
  useTitle(state.data?.student.full_name);
  useReloadWhileOpen(state.reload);
  return <Async state={state}>{(d) => <Detail d={d} reload={state.reload} setData={state.setData}
    setLevel={(code) => setParams({ level: code }, { replace: true })} />}</Async>;
}

function Detail({ d, reload, setData, setLevel }) {
  const { student: st, summary } = d;
  const toast = useToast();
  const [form, setForm] = useState({ full_name: st.full_name, level: st.level?.code || "", classroom: st.classroom?.id || "", is_active: st.is_active });
  const [errors, setErrors] = useState({});
  useEffect(() => setForm({ full_name: st.full_name, level: st.level?.code || "", classroom: st.classroom?.id || "", is_active: st.is_active }),
    [st.id, st.full_name, st.level?.code, st.classroom?.id, st.is_active]);
  const classesForLevel = d.classrooms.filter((c) => c.level && c.level === form.level);
  const chooseLevel = (level) => setForm((f) => ({
    ...f, level, classroom: d.classrooms.some((c) => String(c.id) === String(f.classroom) && c.level === level) ? f.classroom : "",
  }));

  const save = async (e) => {
    e.preventDefault();
    try {
      const moved = form.level && form.level !== (st.level?.code || "");
      const fresh = await api(`/teacher/students/${st.id}/`, { method: "PATCH", body: { ...form, level: form.level || null } });
      setData(fresh);
      setErrors({});
      toast(moved ? `${form.full_name} is now in ${form.level}.` : `Saved changes for ${form.full_name}.`);
      if (moved) setLevel(fresh.level.code);
    } catch (err) {
      setErrors(err.fieldErrors);
    }
  };

  const removeAccess = async () => {
    try {
      const res = await api(`/teacher/requests/${d.access_request}/decide/`, { method: "POST", body: { decision: "rejected" } });
      toast(res.message);
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <>
      <PageHead crumb={{ to: "/teacher/students", label: "Students" }} title={st.full_name}>
        <p className="muted">{st.email}. Joined {formatDate(st.date_joined)}{summary.last_active ? `, last practised ${formatDate(summary.last_active)}` : ""}.
          {st.status !== "approved" && <> <span className="badge badge-bad">No access</span></>}
          {st.level ? <> <span className="badge badge-royal">{st.level.code} student</span></> : <> <span className="badge badge-note">No level set</span></>}</p>
      </PageHead>

      <div className="student-level">
        <div className="seg" role="group" aria-label="Show progress for level">
          {d.levels.map((lv) => (
            <button key={lv.code} type="button" aria-pressed={lv.code === d.level.code} onClick={() => setLevel(lv.code)}>
              {lv.code} <span className="seg-sub">{lv.name}</span>
            </button>
          ))}
        </div>
        <span className="muted small">Currently studying {d.studying.code}. Everything below is for {d.level.code} only.</span>
      </div>

      <div className="stats">
        <div className="stat"><b>{summary.words_seen}<small className="stat-of"> / {summary.words_total}</small></b><span>{d.level.code} words practised, {summary.words_learned} learned for good</span></div>
        <div className="stat"><b>{summary.quiz_accuracy != null ? `${summary.quiz_accuracy}%` : "–"}</b><span>quiz answers correct ({plural(summary.quizzes_done, "quiz", "quizzes")})</span></div>
        <div className="stat"><b>{summary.speaking_done}</b><span>speaking tasks practised</span></div>
        <div className="stat"><b>{summary.videos_watched}</b><span>videos watched</span></div>
      </div>

      <div className="split section">
        <div>
          <h2 className="mb-4">Recent {d.level.code} activity</h2>
          {d.activity.length ? (
            <ul className="list activity-list">
              {d.activity.map((e, i) => {
                const inner = (
                  <>
                    <span className={`activity-icon activity-${e.kind}`}><Icon name={ACTIVITY_ICON[e.kind]} /></span>
                    <span className="row-main">
                      <span className="row-title">{e.title}</span>
                      <span className="row-sub">{[e.sub, formatDate(e.at, true)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {e.kind === "quiz" && <span className={`badge ${scoreClass(e.score, e.total)}`}>{e.score}/{e.total}</span>}
                  </>
                );
                return e.answer_id
                  ? <li key={i}><Link className="row" to={`/teacher/speaking/${e.answer_id}`}>{inner}<span className="chev"><Icon name="chevron" /></span></Link></li>
                  : <li key={i} className="row">{inner}</li>;
              })}
            </ul>
          ) : <p className="muted">Nothing at {d.level.code} yet. As soon as {st.full_name.split(" ")[0]} studies {d.level.code} words, takes a quiz, practises speaking or watches a video, it shows up here.</p>}

          <h2 className="mt-6 mb-4">{d.level.code} word decks</h2>
          {d.decks.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th scope="col">Deck</th><th scope="col">Practised</th><th scope="col">Learned for good</th><th scope="col">Last studied</th></tr></thead>
                <tbody>
                  {d.decks.map((k) => (
                    <tr key={k.id}>
                      <td><span lang="de">{k.name}</span> <span className="muted small">{k.level}</span></td>
                      <td>
                        <span className="deck-progress">
                          <span className="meter meter-mini"><span style={{ width: `${(k.practised / Math.max(k.total, 1)) * 100}%` }} /></span>
                          {k.practised} of {k.total}
                        </span>
                      </td>
                      <td>{k.learned} of {k.total}</td>
                      <td className="nowrap">{formatDate(k.last_studied, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Hasn't studied any {d.level.code} word decks yet.</p>}
          <p className="muted small mt-2">A word counts as learned for good once {st.full_name.split(" ")[0]} has known it several times over a few days.</p>

          <h2 className="mt-6 mb-4">{d.level.code} quiz results</h2>
          {d.attempts.length ? (
            <ul className="list">
              {d.attempts.map((a) => (
                <li className="row" key={a.id}><span className="row-main"><span className="row-title">{a.title}</span><span className="row-sub">{formatDate(a.finished_at, true)}</span></span>
                  <span className={`badge ${scoreClass(a.score, a.total)}`}>{a.score}/{a.total}</span></li>
              ))}
            </ul>
          ) : <p className="muted">No {d.level.code} quizzes finished yet.</p>}

          <h2 className="mt-6 mb-4">{d.level.code} speaking answers</h2>
          {d.speaking.length ? (
            <ul className="list">
              {d.speaking.map((x) => (
                <li key={x.id}><Link className="row" to={`/teacher/speaking/${x.id}`}>
                  <span className="row-main"><span className="row-title" lang="de">{x.task.title}</span><span className="row-sub">{x.task.level} {x.task.part_label}, sent {formatDate(x.submitted_at)}</span></span>
                  {x.reviewed ? <span className={`badge ${scoreClass(x.total_score, x.max_score)}`}>{x.total_score}/{x.max_score}</span> : <span className="badge badge-note">Waiting</span>}
                  <span className="chev"><Icon name="chevron" /></span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="muted">Hasn't sent an {d.level.code} speaking answer yet.</p>}

          <h2 className="mt-6 mb-4">{d.level.code} videos</h2>
          {d.videos.length ? (
            <ul className="list">
              {d.videos.map((v, i) => (
                <li className="row" key={i}><span className="row-main"><span className="row-title">{v.title}</span></span>
                  {v.watched_at ? <span className="badge badge-good">Watched {formatDate(v.watched_at)}</span> : <span className="badge">Opened</span>}</li>
              ))}
            </ul>
          ) : <p className="muted">Hasn't opened any {d.level.code} videos yet.</p>}
        </div>

        <aside className="panel">
          <h2 className="mb-4">Details</h2>
          <form className="form" onSubmit={save} noValidate>
            <Field label="Name" name="full_name" errors={errors} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Field as="select" label="Level" name="level" errors={errors} value={form.level} onChange={(e) => chooseLevel(e.target.value)}
              help={form.level ? `Sees ${form.level} and the levels below it, nothing higher.` : "Not set yet: this student can open every level."}>
              {!st.level && <option value="">No level set</option>}
              {d.all_levels.map((lv) => <option key={lv.code} value={lv.code}>{lv.code} {lv.name}</option>)}
            </Field>
            <Field as="select" label="Class" name="classroom" errors={errors} value={form.classroom} disabled={!form.level}
              help={form.level ? `Only ${form.level} classes are listed.` : "Set a level first."}
              onChange={(e) => setForm({ ...form, classroom: e.target.value })}>
              <option value="">No class</option>
              {classesForLevel.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Field>
            <Checkbox label="Account can sign in" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <button className="btn btn-primary" type="submit">Save</button>
          </form>
          {d.access_request && st.status === "approved" && (
            <details className="danger mt-5">
              <summary>Remove access</summary>
              <p>{st.full_name} won't be able to open any practice pages. Their progress is kept and you can approve them again later.</p>
              <button className="btn btn-danger btn-small" type="button" onClick={removeAccess}>Remove access</button>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { Async, Empty, Field, FormError, PageHead, scoreClass } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { useOnNewActivity } from "../../lib/live";
import { useSession } from "../../lib/session";
import { formatDate } from "../../lib/speech";

export function SpeakingInbox() {
  useTitle("Speaking answers");
  const [params, setParams] = useSearchParams();
  const show = params.get("show") === "reviewed" ? "reviewed" : "waiting";
  const state = useApi(`/teacher/speaking/?show=${show}`);
  useOnNewActivity(state.reload, ["speaking"]);
  return (
    <>
      <PageHead title="Speaking answers">
        <p className="muted">Recordings your students sent. Listen, score and write feedback. Each recording is deleted 3 days after your feedback; scores and feedback stay.</p>
      </PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <nav className="chips" aria-label="Filter answers">
              <button type="button" className="chip" aria-current={show === "waiting"} onClick={() => setParams({})}>Waiting for feedback ({d.waiting_count})</button>
              <button type="button" className="chip" aria-current={show === "reviewed"} onClick={() => setParams({ show: "reviewed" })}>Feedback given ({d.reviewed_count})</button>
            </nav>
            {d.answers.length ? (
              <ul className="list">
                {d.answers.map((a) => (
                  <li key={a.id}>
                    <Link className="row" to={`/teacher/speaking/${a.id}`}>
                      <Icon name="speaking" />
                      <span className="row-main">
                        <span className="row-title">{a.student.full_name}<span className="muted fw-normal">: </span><span lang="de">{a.task.title}</span></span>
                        <span className="row-sub">{a.task.level} {a.task.part_label}{a.student.classroom ? `, ${a.student.classroom}` : ""}. Sent {formatDate(a.submitted_at, true)}</span>
                      </span>
                      <span className="row-end">
                        {a.reviewed ? <span className={`badge ${scoreClass(a.total_score, a.max_score)}`}>{a.total_score}/{a.max_score}</span> : <span className="badge badge-note">New</span>}
                        <span className="chev"><Icon name="chevron" /></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : show === "waiting" ? (
              <Empty title="All caught up">No answers are waiting. When a student sends a recording from a speaking task, it appears here.</Empty>
            ) : <Empty title="No feedback given yet">Answers you've scored appear here.</Empty>}
          </>
        )}
      </Async>
    </>
  );
}

export function SpeakingReview() {
  const { id } = useParams();
  const state = useApi(`/teacher/speaking/${id}/`);
  useTitle(state.data ? `${state.data.answer.student.full_name}: ${state.data.task.title}` : "Speaking answer");
  return <Async state={state}>{(d) => <Review key={d.answer.id} d={d} setData={state.setData} />}</Async>;
}

function Review({ d, setData }) {
  const { answer: a, task } = d;
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useSession();
  const initial = Object.fromEntries(a.scores.map((c) => [c.field, c.value || ""]));
  const [scores, setScores] = useState(initial);
  const [feedback, setFeedback] = useState(a.feedback || "");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setScores(initial); setFeedback(a.feedback || ""); /* eslint-disable-next-line */ }, [a.id]);

  const submit = async (openNext) => {
    setBusy(true);
    try {
      const res = await api(`/teacher/speaking/${a.id}/`, { method: "POST", body: { ...scores, feedback } });
      toast(res.message);
      refresh();
      setErrors({});
      setError(null);
      if (openNext && res.next_id) navigate(`/teacher/speaking/${res.next_id}`);
      else if (openNext || !a.reviewed) navigate("/teacher/speaking");
      else setData(res);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
    }
    setBusy(false);
  };

  const total = Object.values(scores).every(Boolean) ? Object.values(scores).reduce((s, v) => s + Number(v), 0) : null;

  return (
    <>
      <PageHead crumb={{ to: `/teacher/speaking${a.reviewed ? "?show=reviewed" : ""}`, label: "Speaking answers" }}
        title={<>{a.student.full_name}: <span lang="de">{task.title}</span></>}>
        <p className="muted"><span className="badge badge-royal">{task.level} {task.part_label}</span> Sent {formatDate(a.submitted_at, true)}{a.student.classroom ? `, ${a.student.classroom}` : ""}. <Link to={`/teacher/students/${a.student.id}`}>Student's page</Link></p>
      </PageHead>

      <div className="split">
        <div className="stack-5">
          <section className="panel">
            <h2 className="mb-3">Recording</h2>
            {a.has_audio ? (
              <>
                <audio className="audio" controls preload="metadata" src={a.audio_url}>Your browser can't play this recording.</audio>
                <p className="muted small mt-3 mb-0">{a.reviewed ? `Deleted automatically on ${formatDate(a.audio_delete_on)}.` : `Kept until ${a.keep_days} days after you send feedback.`}</p>
              </>
            ) : <p className="muted">The recording was deleted on {formatDate(a.audio_deleted_at)}, {a.keep_days} days after feedback.</p>}
          </section>

          <section className="panel">
            <form className="form form-wide" noValidate onSubmit={(e) => { e.preventDefault(); submit(false); }}>
              <FormError error={error} />
              <div className="score-grid">
                {a.scores.map((c) => (
                  <fieldset key={c.field} className={`score-row${errors[c.field] ? " has-error" : ""}`}>
                    <legend>{c.label}</legend>
                    <div className="pips">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n}>
                          <input type="radio" name={c.field} value={n} checked={String(scores[c.field]) === String(n)} onChange={() => setScores({ ...scores, [c.field]: n })} />
                          <span>{n}</span>
                        </label>
                      ))}
                    </div>
                    {errors[c.field] && <p className="error">{errors[c.field].join(" ")}</p>}
                  </fieldset>
                ))}
              </div>
              <p className="muted small m-0">1 = not yet, 3 = good, 5 = excellent. {total != null ? `Total: ${total} of 20.` : "Total out of 20."}</p>
              <Field as="textarea" rows={5} label={`Feedback for ${a.student.first_name}`} name="feedback" errors={errors}
                placeholder="What went well, and one thing to work on…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <div className="actions">
                <button className="btn btn-primary" type="submit" aria-disabled={busy}>{a.reviewed ? "Update feedback" : "Send feedback"}</button>
                {d.waiting_after > 0 && <button className="btn btn-secondary" type="button" aria-disabled={busy} onClick={() => submit(true)}>Send and open next ({d.waiting_after} waiting)</button>}
              </div>
              {a.reviewed && <p className="muted small m-0">Feedback sent {formatDate(a.reviewed_at, true)}. The student already sees it; updating changes what they see.</p>}
            </form>
          </section>
        </div>

        <aside className="stack-4">
          <section className="panel">
            <h2 className="mb-2">The task</h2>
            <p className="muted small">{task.brief}</p>
            <div className="prompt-sheet paper small" lang="de">{task.prompt}</div>
            {task.questions.length > 0 && (
              <>
                <h3 className="mt-4 mb-2">Questions</h3>
                <ul className="plain-list" lang="de">{task.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </>
            )}
          </section>
          <details className="reveal">
            <summary>Model answer</summary>
            <div className="reveal-body pre-line" lang="de">{task.model_answer}</div>
          </details>
        </aside>
      </div>
    </>
  );
}

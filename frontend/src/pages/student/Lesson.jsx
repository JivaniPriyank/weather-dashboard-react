import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Blocks from "../../components/lesson/Blocks";
import { useToast } from "../../components/Toasts";
import { Async } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function Lesson() {
  const { id } = useParams();
  const state = useApi(`/lessons/${id}/`);
  useTitle(state.data?.lesson.title);
  // key: a fresh page (and fresh exercises) for every lesson
  return <Async state={state}>{(d) => <LessonPage key={d.lesson.id} data={d} />}</Async>;
}

function LessonPage({ data }) {
  const { lesson, section, previous, next } = data;
  const { user } = useSession();
  const toast = useToast();
  const [progress, setProgress] = useState(data.progress);
  const [results, setResults] = useState({}); // block index → [right, answered]
  const [busy, setBusy] = useState(false);
  const saved = useRef(false);

  const onResult = useCallback((i, right, answered) => {
    setResults((r) => (r[i]?.[0] === right && r[i]?.[1] === answered ? r : { ...r, [i]: [right, answered] }));
  }, []);
  const right = Object.values(results).reduce((n, [r]) => n + r, 0);
  const answered = Object.values(results).reduce((n, [, a]) => n + a, 0);
  const total = lesson.exercises;

  const markDone = async (score = right) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api(`/lessons/${lesson.id}/done/`, { method: "POST", body: { score } });
      setProgress(res.progress);
      toast(total ? `Lesson done: ${score} of ${total} right.` : res.message);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    try {
      await api(`/lessons/${lesson.id}/done/`, { method: "DELETE" });
      setProgress(null);
      saved.current = true; // don't mark it done again by itself
    } catch (e) {
      toast(e.message, "error");
    }
  };

  // When every exercise is answered, the lesson counts as done by itself (again after
  // "Try again": the server keeps the best score).
  useEffect(() => {
    if (answered < total) saved.current = false;
    else if (total && !saved.current && !user.is_teacher) {
      saved.current = true;
      markDone(right);
    }
  }, [answered]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className="lsn-page">
      <div className="lsn-head">
        <Link className="crumb" to={`/sections/${section.id}`}>{section.title} · Lesson {lesson.position} of {lesson.count}</Link>
        <h1 lang="de">{lesson.title}</h1>
        {!lesson.is_published && <p className="badge badge-note">Draft: students can't see this lesson yet</p>}
      </div>

      {total > 0 && (
        <div className="lsn-score" role="status">
          <span>{right} of {total} right</span>
          <span className="lsn-score-bar" aria-hidden="true"><span style={{ width: `${(right / total) * 100}%` }} /></span>
        </div>
      )}

      <Blocks blocks={lesson.blocks} onResult={onResult} />

      <div className="lsn-foot">
        {previous ? <Link className="lsn-prev" to={`/sections/${section.id}/lessons/${previous.id}`}>‹ {previous.title}</Link> : <span />}
        <div className="actions">
          {user.is_teacher ? (
            <span className="muted small">Students mark lessons as done here.</span>
          ) : progress ? (
            <>
              <span className="lsn-done-badge"><Icon name="check" />Done{progress.total ? ` · ${progress.score} of ${progress.total}` : ""}</span>
              <button className="btn btn-quiet btn-small" type="button" onClick={undo}>Not done</button>
            </>
          ) : (
            <button className="btn btn-secondary" type="button" aria-disabled={busy} onClick={() => markDone()}>
              <Icon name="check" />Mark lesson as done
            </button>
          )}
          {next
            ? <Link className="btn btn-primary" to={`/sections/${section.id}/lessons/${next.id}`}>Next: <span lang="de">{next.title}</span><Icon name="chevron" /></Link>
            : <Link className="btn btn-primary" to={`/sections/${section.id}`}>Back to {section.title}</Link>}
        </div>
      </div>
    </article>
  );
}

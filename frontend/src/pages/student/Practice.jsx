import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toasts";
import { Async, Empty, PageHead, RowLink, scoreClass } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";
import { formatDate } from "../../lib/speech";

export function useStartQuiz() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const start = async (level, topic) => {
    setBusy(true);
    try {
      const { attempt } = await api("/practice/start/", { method: "POST", body: { level, topic } });
      navigate(`/practice/${attempt}`);
    } catch (e) {
      toast(e.message, "error");
      setBusy(false);
    }
  };
  return [start, busy];
}

export default function Practice() {
  useTitle("Practice");
  const state = useApi("/practice/", [useLevelKey()]);
  const [start, busy] = useStartQuiz();
  return (
    <Async state={state}>
      {({ level, total, topics, recent, unfinished }) => (
        <>
          <PageHead title="Practice"><p className="muted">Short {level.code} quizzes. Every answer comes with an explanation.</p></PageHead>
          {unfinished && (
            <div className="notice notice-royal">You have an unfinished quiz: <b>{unfinished.title}</b>. <Link to={`/practice/${unfinished.id}`}>Carry on</Link></div>
          )}
          {total ? (
            <>
              <section className="focus-card paper">
                <div><h2>Mixed {level.code} quiz</h2><p>Up to 10 questions from all {total} at this level, in a new order every time.</p></div>
                <button className="btn btn-primary" type="button" aria-disabled={busy} onClick={() => start(level.code)}>Start mixed quiz</button>
              </section>
              {topics.length > 0 && (
                <section className="section">
                  <h2>By grammar topic</h2>
                  <ul className="list">
                    {topics.map((t) => (
                      <li className="row" key={t.id}>
                        <span className="row-main"><span className="row-title" lang="de">{t.title}</span>
                          <span className="row-sub">{t.questions} question{t.questions === 1 ? "" : "s"}. <Link to={`/grammar/${t.level}/${t.slug}`}>Read the rule</Link></span></span>
                        <button className="btn btn-secondary btn-small" type="button" aria-disabled={busy} aria-label={`Start quiz: ${t.title}`} onClick={() => start(level.code, t.id)}>Start</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <Empty title={`No ${level.code} questions yet`}>Your teacher hasn't added quiz questions at this level. Switch level at the top, or check back later.</Empty>
          )}
          {recent.length > 0 && (
            <section className="section">
              <h2>Recent results</h2>
              <ul className="list">
                {recent.map((a) => (
                  <RowLink key={a.id} to={`/practice/${a.id}/results`} title={a.title} sub={formatDate(a.finished_at, true)}
                    end={<span className={`badge ${scoreClass(a.score, a.total)}`}>{a.score} / {a.total}</span>} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Async>
  );
}

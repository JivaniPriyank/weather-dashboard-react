import { Link } from "react-router-dom";
import { Async, Empty, Meter, PageHead, RowLink, scoreClass } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";
import { formatDate, plural } from "../../lib/speech";

const summary_level = (state) => state.data?.level?.code || "";

export default function Progress() {
  useTitle("Progress");
  const state = useApi("/progress/", [useLevelKey()]);
  return (
    <Async state={state}>
      {({ summary, levels, attempts }) => (
        <>
          <PageHead title={`Your ${summary_level(state)} progress`}>
            <p className="muted">{summary.streak ? `${plural(summary.streak, "day")} in a row. ` : ""}A word is learned for good once you've known it three times in a row, a few days apart.</p>
          </PageHead>
          <div className="stats">
            <div className="stat"><b>{summary.words_seen}</b><span>words practised, {summary.words_learned} learned for good</span></div>
            <div className="stat"><b>{summary.quiz_accuracy != null ? `${summary.quiz_accuracy}%` : "–"}</b><span>quiz answers correct</span></div>
            <div className="stat"><b>{summary.speaking_done}</b><span>speaking tasks practised</span></div>
            <div className="stat"><b>{summary.videos_watched}</b><span>videos watched</span></div>
          </div>

          {levels.map(({ level, summary: ls, decks }) => (
            <section className="section" key={level.code}>
              <div className="section-head"><h2>{level.code} words</h2><span className="muted">{ls.words_seen} of {ls.words_total} practised, {ls.words_learned} learned</span></div>
              {decks.length ? (
                <ul className="list">
                  {decks.map((d) => (
                    <li key={d.slug}>
                      <Link className="row" to={`/words/${d.level}/${d.slug}`}>
                        <span className="row-main"><span className="row-title">{d.name}</span>
                          <Meter percent={d.stats.percent} practised={d.stats.practised_percent}
                            label={`${d.stats.seen} of ${d.stats.total} practised, ${d.stats.learned} learned for good`} className="deck-meter" />
                          <span className="row-sub">{d.stats.seen} of {d.stats.total} practised{d.stats.learned ? `, ${d.stats.learned} learned for good` : ""}</span></span>
                        <span className="row-end">{d.stats.seen}/{d.stats.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No word decks at this level yet.</p>}
            </section>
          ))}

          <section className="section">
            <h2>Recent quizzes</h2>
            {attempts.length ? (
              <ul className="list">
                {attempts.map((a) => (
                  <RowLink key={a.id} to={`/practice/${a.id}/results`} title={a.title} sub={formatDate(a.finished_at, true)}
                    end={<span className={`badge ${scoreClass(a.score, a.total)}`}>{a.score} / {a.total}</span>} />
                ))}
              </ul>
            ) : (
              <Empty title="No quizzes yet" action={<Link className="btn btn-primary" to="/practice">Take a quiz</Link>}>Finish a quiz and your results show up here.</Empty>
            )}
          </section>
        </>
      )}
    </Async>
  );
}

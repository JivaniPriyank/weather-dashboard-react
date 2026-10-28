import { Link } from "react-router-dom";
import { Async, Empty, Meter, PageHead, RowLink, scoreClass } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";
import { formatDate, plural } from "../../lib/speech";
import { useStartQuiz } from "./Practice";

const summary_level = (state) => state.data?.level?.code || "";

// Darker squares for days with more practice.
const shade = (n) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);
const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// The last 12 weeks: one column per week (Monday at the top), one square per day.
function ActivityCalendar({ days }) {
  const active = days.filter((d) => d.count > 0).length;
  const firstWeekday = (new Date(`${days[0].date}T12:00:00`).getDay() + 6) % 7; // Monday = 0
  return (
    <div className="calendar-wrap">
      <div className="calendar" role="img" aria-label={`Practised on ${active} of the last ${days.length} days`}>
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad${i}`} className="cal-pad" />)}
        {days.map((d) => (
          <span key={d.date} className={`cal-day cal-${shade(d.count)}`}
            title={`${dayLabel(d.date)}: ${d.count ? plural(d.count, "thing") + " practised" : "no practice"}`} />
        ))}
      </div>
      <div className="calendar-legend" aria-hidden="true">
        <span>Less</span>{[0, 1, 2, 3, 4].map((n) => <span key={n} className={`cal-day cal-${n}`} />)}<span>More</span>
      </div>
      <p className="muted small mb-0">Practised on <b>{active}</b> of the last {days.length} days.</p>
    </div>
  );
}

// New, learning and learned words as one bar.
function WordStages({ total, seen, learned }) {
  const parts = [
    { key: "learned", n: learned, label: "learned for good" },
    { key: "learning", n: seen - learned, label: "learning" },
    { key: "new", n: total - seen, label: "not practised yet" },
  ];
  return (
    <div className="stages">
      <div className="stages-bar" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(", ")}>
        {parts.map((p) => p.n > 0 && <span key={p.key} className={`stage-${p.key}`} style={{ flexGrow: p.n }} />)}
      </div>
      <ul className="stages-legend">
        {parts.map((p) => <li key={p.key}><span className={`stage-dot stage-${p.key}`} aria-hidden="true" /><b>{p.n}</b> {p.label}</li>)}
      </ul>
    </div>
  );
}

export default function Progress() {
  useTitle("Progress");
  const state = useApi("/progress/", [useLevelKey()]);
  const [start, busy] = useStartQuiz();
  return (
    <Async state={state}>
      {({ summary, levels, attempts, calendar, topics }) => (
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

          <section className="section">
            <h2>Last 12 weeks</h2>
            <ActivityCalendar days={calendar} />
          </section>

          {levels.map(({ level, summary: ls, decks }) => (
            <section className="section" key={level.code}>
              <h2>{level.code} words</h2>
              <WordStages total={ls.words_total} seen={ls.words_seen} learned={ls.words_learned} />
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

          {topics.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>Grammar topics</h2><span className="muted small">Weakest first</span></div>
              <ul className="list">
                {topics.map((t) => (
                  <li className="row topic-score" key={t.id}>
                    <span className="row-main">
                      <span className="row-title" lang="de">{t.title}</span>
                      <Meter className="deck-meter" percent={t.percent} good={t.percent >= 70} label={`${t.percent}% right`} />
                      <span className="row-sub">{t.right} of {plural(t.answered, "answer")} right. <Link to={`/grammar/${t.level}/${t.slug}`}>Read the rule</Link></span>
                    </span>
                    <span className={`badge ${scoreClass(t.right, t.answered)}`}>{t.percent}%</span>
                    <button className="btn btn-secondary btn-small" type="button" aria-disabled={busy}
                      aria-label={`Practise ${t.title}`} onClick={() => start(t.level, t.id)}>Practise</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

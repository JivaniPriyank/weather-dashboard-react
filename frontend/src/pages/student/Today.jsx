import { Link, Navigate, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, RowLink } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";
import { plural } from "../../lib/speech";
import { useSession } from "../../lib/session";

export default function Today() {
  useTitle("Today");
  const { user } = useSession();
  const [params] = useSearchParams();
  const levelKey = useLevelKey();
  const state = useApi(user.is_teacher && !params.get("as_student") ? null : "/today/", [levelKey]);
  if (user.is_teacher && !params.get("as_student")) return <Navigate to="/teacher" replace />;

  return (
    <Async state={state}>
      {({ level, summary, ready, next_deck, unfinished, new_videos }) => (
        <>
          <div className="greeting">
            <h1>Hallo, {user.first_name}!</h1>
            <p className="muted">
              {summary.streak ? `${plural(summary.streak, "day")} in a row. Keep it going.` : `Studying ${level.code} (${level.name}). A few minutes a day is enough.`}
            </p>
          </div>

          {unfinished && (
            <div className="notice notice-royal">
              You have an unfinished quiz: <b>{unfinished.title}</b>. <Link to={`/practice/${unfinished.id}`}>Carry on</Link>
            </div>
          )}

          {next_deck ? (
            <section className="focus-card paper">
              <div>
                <h2>Study {next_deck.name}</h2>
                <p>{next_deck.description}. {plural(next_deck.stats.due, "card")} ready, {next_deck.stats.learned} of {next_deck.stats.total} learned so far.</p>
              </div>
              <div className="actions"><Link className="btn btn-primary" to={`/words/${next_deck.level}/${next_deck.slug}/study`}>Start studying</Link></div>
            </section>
          ) : summary.words_total > 0 && (
            <section className="focus-card paper">
              <div>
                <h2>All words reviewed for now</h2>
                <p>Nothing is due in {level.code}. Try a quiz or a speaking task, or come back tomorrow for your next reviews.</p>
              </div>
              <div className="actions"><Link className="btn btn-primary" to="/practice">Take a quiz</Link></div>
            </section>
          )}

          <section className="section">
            <h2 className="visually-hidden">Go to</h2>
            <div className="quick">
              <Link to="/words"><Icon name="words" />Words<span>{ready} ready to study</span></Link>
              <Link to="/practice"><Icon name="practice" />Practice<span>{summary.quiz_accuracy != null ? `${summary.quiz_accuracy}% correct so far` : "Grammar quizzes"}</span></Link>
              <Link to="/speaking"><Icon name="speaking" />Speaking<span>Record exam answers</span></Link>
              <Link to="/grammar"><Icon name="grammar" />Grammar<span>Rules and tables</span></Link>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Your {level.code} progress</h2><Link to="/progress">See all progress</Link></div>
            <div className="stats">
              <div className="stat"><b>{summary.words_seen}<small className="muted" style={{ fontSize: "1rem" }}> / {summary.words_total}</small></b><span>words practised, {summary.words_learned} learned for good</span></div>
              <div className="stat"><b>{summary.quizzes_done}</b><span>quizzes finished</span></div>
              <div className="stat"><b>{summary.speaking_done}</b><span>speaking tasks practised</span></div>
              <div className="stat"><b>{summary.videos_watched}</b><span>videos watched</span></div>
            </div>
          </section>

          {new_videos.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>New from your teacher</h2><Link to="/videos">All videos</Link></div>
              <ul className="list">
                {new_videos.map((v) => (
                  <RowLink key={v.id} to={`/videos/${v.id}`} icon="videos" title={v.title}
                    sub={v.grammar_topic ? v.grammar_topic.title : v.level || "For everyone"} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Async>
  );
}

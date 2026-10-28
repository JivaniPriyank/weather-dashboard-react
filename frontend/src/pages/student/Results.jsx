import { Link, useParams } from "react-router-dom";
import { Async } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useStartQuiz } from "./Practice";

export default function Results() {
  const { id } = useParams();
  const state = useApi(`/attempts/${id}/results/`);
  useTitle(state.data ? `Results: ${state.data.attempt.title}` : "Results");
  const [start, busy] = useStartQuiz();
  return (
    <div className="quiz">
      <Async state={state}>
        {({ attempt, topic, missed }) => (
          <>
            <Link className="crumb" to="/practice">Practice</Link>
            <h1 style={{ marginBottom: "var(--s5)" }}>{attempt.title}</h1>
            <div className="panel" style={{ textAlign: "center" }}>
              <div className="score-ring" style={{ "--p": attempt.percent }} role="img" aria-label={`${attempt.score} of ${attempt.total} correct`}>
                <b>{attempt.score}/{attempt.total}</b>
              </div>
              <h2>{attempt.percent >= 90 ? "Sehr gut!" : attempt.percent >= 70 ? "Gut gemacht!" : attempt.percent >= 50 ? "Good progress" : "Keep practising"}</h2>
              <p className="muted">{attempt.percent}% correct{missed.length ? `. Go over the ${missed.length} question${missed.length === 1 ? "" : "s"} you missed below.` : ". You didn't miss a single one."}</p>
              <div className="actions" style={{ justifyContent: "center", marginTop: "var(--s4)" }}>
                <button className="btn btn-primary" type="button" aria-disabled={busy} onClick={() => start(attempt.level, attempt.topic_id || undefined)}>Try again</button>
                {topic && <Link className="btn btn-secondary" to={`/grammar/${topic.level}/${topic.slug}`}>Read the rule</Link>}
              </div>
            </div>
            {missed.length > 0 && (
              <section className="section">
                <h2>What you missed</h2>
                <ul className="list">
                  {missed.map((m, i) => (
                    <li className="row" key={i}>
                      <div className="row-main">
                        <span className="row-title" lang="de">{m.prompt}</span>
                        <div className="answer-line" style={{ marginTop: "var(--s2)" }}>
                          <span>You: <span className="you" lang="de">{m.given}</span></span>
                          <span>Correct: <span className="right" lang="de">{m.correct}</span></span>
                        </div>
                        {m.explanation && <p className="row-sub" style={{ margin: "var(--s2) 0 0" }}>{m.explanation}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Async>
    </div>
  );
}

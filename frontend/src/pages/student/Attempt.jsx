import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";

export default function Attempt() {
  const { id } = useParams();
  const state = useApi(`/attempts/${id}/`);
  useTitle(state.data?.attempt.title || "Quiz");
  return (
    <div className="quiz">
      {state.loading && state.data ? <Loading label="Loading the next question…" /> : (
      <Async state={state}>
        {(data) => data.finished
          ? <Navigate to={`/practice/${id}/results`} replace />
          : <Question key={data.question.id} data={data} onNext={state.reload} />}
      </Async>
      )}
    </div>
  );
}

function Question({ data, onNext }) {
  const { attempt, question, position } = data;
  const [option, setOption] = useState(null);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nextRef = useRef(null);
  const isLast = position === attempt.total;

  useEffect(() => { if (feedback) nextRef.current?.focus(); }, [feedback]);

  const submit = async (e) => {
    e.preventDefault();
    if (question.kind === "choice" && !option) return setError("Pick one of the answers first.");
    if (question.kind === "typed" && !typed.trim()) return setError("Type your answer first.");
    setBusy(true);
    setError(null);
    try {
      setFeedback(await api(`/attempts/${attempt.id}/answer/`, { method: "POST", body: { question: question.id, option, typed } }));
    } catch (err) {
      if (err.status === 409) onNext();
      else setError(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      <Link className="crumb" to="/practice">Practice</Link>
      <h1 className="mb-5">{attempt.title}</h1>
      <div className="quiz-top">
        <span className="nowrap">Question {position} of {attempt.total}</span>
        <div className="meter" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={attempt.total} aria-valuenow={position}>
          <span style={{ width: `${(position / attempt.total) * 100}%` }} />
        </div>
      </div>

      <div className="question paper">
        <p className="prompt" lang="de">{question.prompt}</p>
        {feedback ? (
          <>
            {question.kind === "choice" ? (
              <div className="options">
                {question.options.map((o) => {
                  const right = o.id === feedback.correct_option;
                  const wrong = !right && o.id === feedback.selected_option;
                  return (
                    <div key={o.id} className={`option${right ? " is-right" : wrong ? " is-wrong" : ""}`}>
                      <span>
                        {right && <span className="mark"><Icon name="check" label="Correct answer" /></span>}
                        {wrong && <span className="mark"><Icon name="x" label="Your answer" /></span>}
                        <span lang="de">{o.text}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="answer-line">
                <span>Your answer: <span className={feedback.is_correct ? "right" : "you"} lang="de">{feedback.typed}</span></span>
                {!feedback.is_correct && <span>Correct: <span className="right" lang="de">{feedback.correct_answer}</span></span>}
              </div>
            )}
            <div className={`feedback ${feedback.is_correct ? "good" : "bad"}`} role="status">
              <b>{feedback.is_correct ? "Richtig! That's correct." : "Not quite."}</b>
              {feedback.explanation && <p>{feedback.explanation}</p>}
            </div>
            <div className="actions mt-5">
              {isLast
                ? <Link ref={nextRef} className="btn btn-primary" to={`/practice/${attempt.id}/results`}>See your results</Link>
                : <button ref={nextRef} className="btn btn-primary" type="button" onClick={onNext}>Next question</button>}
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            {question.kind === "choice" ? (
              <fieldset>
                <legend className="visually-hidden">Choose one answer</legend>
                <div className="options">
                  {question.options.map((o) => (
                    <label className="option" key={o.id}>
                      <input type="radio" name="option" value={o.id} checked={option === o.id} onChange={() => setOption(o.id)} />
                      <span lang="de">{o.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div className="field">
                <label htmlFor="typed">Type your answer</label>
                <input type="text" id="typed" autoComplete="off" autoCapitalize="off" spellCheck="false" lang="de" autoFocus
                  value={typed} onChange={(e) => setTyped(e.target.value)} />
                <p className="help">Spelling counts, capital letters don't. Ä, Ö, Ü and ß matter.</p>
              </div>
            )}
            {error && <p className="form-errors mt-4" role="alert">{error}</p>}
            <div className="actions mt-5">
              <button className="btn btn-primary" type="submit" aria-disabled={busy}>Check answer</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

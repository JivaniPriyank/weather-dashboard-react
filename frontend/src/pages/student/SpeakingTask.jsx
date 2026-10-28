import { useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Recorder from "../../components/Recorder";
import { useToast } from "../../components/Toasts";
import { Async, PageHead, SayButton } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { formatDate } from "../../lib/speech";

export default function SpeakingTask() {
  const { level, slug } = useParams();
  const state = useApi(`/speaking/${level}/${slug}/`);
  const toast = useToast();
  useTitle(state.data?.task.title);

  const notePractised = async () => {
    try {
      const { practised } = await api(`/speaking/${level}/${slug}/practised/`, { method: "POST" });
      state.setData((d) => ({ ...d, practised }));
      toast("Noted in your progress.");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <Async state={state}>
      {({ task, submission, can_submit, practised, limits }) => (
        <div className="speaking-page">
          <PageHead crumb={{ to: "/speaking", label: "Speaking" }} title={task.title} lang="de">
            <p className="muted"><span className="badge badge-royal">{task.level} {task.part_label}</span> {task.brief}</p>
          </PageHead>

          <div className="prompt-sheet paper" lang="de">{task.prompt}</div>

          {can_submit && (
            submission ? <SentAnswer submission={submission} /> : (
              <Recorder task={task} limits={limits} sendUrl={`/speaking/${level}/${slug}/send/`}
                onSent={(sub) => {
                  state.setData((d) => ({ ...d, submission: sub }));
                  toast("Sent! Your teacher will listen and give you feedback.");
                }} />
            )
          )}

          {task.questions.length > 0 && (
            <section className="speaking-block">
              <h2>Questions to answer</h2>
              <ul className="q-list">
                {task.questions.map((q) => <li key={q}><span lang="de">{q}</span><SayButton text={q} /></li>)}
              </ul>
            </section>
          )}
          {task.phrases.length > 0 && (
            <section className="speaking-block">
              <h2>Useful phrases</h2>
              <div className="phrases">
                {task.phrases.map((p) => <span className="phrase" lang="de" key={p}>{p}<SayButton text={p} /></span>)}
              </div>
            </section>
          )}
          <details className="reveal speaking-block">
            <summary>Model answer</summary>
            <div className="reveal-body" lang="de">
              <p style={{ whiteSpace: "pre-line" }}>{task.model_answer}</p>
              <SayModelAnswer text={task.model_answer} />
            </div>
          </details>

          {can_submit && !submission && (
            <section className="speaking-block practised-note">
              <p className="muted small">Practised out loud without sending?{practised ? ` You've noted it ${practised} time${practised === 1 ? "" : "s"}.` : ""}</p>
              <button className="btn btn-quiet btn-small" type="button" onClick={notePractised}><Icon name="check" />Note it in my progress</button>
            </section>
          )}
        </div>
      )}
    </Async>
  );
}

function SayModelAnswer({ text }) {
  return <span className="say-model"><SayButton text={text} label="Listen to the model answer" /></span>;
}

function SentAnswer({ submission: s }) {
  return (
    <section className="panel answer-panel" id="answer">
      <div className="section-head" style={{ marginBottom: "var(--s3)" }}>
        <h2>Your answer</h2>
        {s.reviewed ? <span className="badge badge-good">Feedback received</span> : <span className="badge badge-note">Sent, waiting for feedback</span>}
      </div>
      {s.has_audio
        ? <audio className="audio" controls preload="metadata" src={s.audio_url}>Your browser can't play this recording.</audio>
        : <p className="muted small">The recording was deleted on {formatDate(s.audio_deleted_at)}. Your score and feedback are kept.</p>}
      {s.reviewed ? (
        <>
          <div className="score-line"><span className="score-big">{s.total_score}</span><span className="muted">/ {s.max_score} points</span></div>
          <dl className="criteria">
            {s.scores.map((c) => <div key={c.field} style={{ display: "contents" }}><dt>{c.label}</dt><dd>{c.value} / 5</dd></div>)}
          </dl>
          <div className="teacher-feedback"><b>Your teacher wrote:</b><p style={{ whiteSpace: "pre-line" }}>{s.feedback}</p></div>
          {s.has_audio && <p className="muted small" style={{ margin: "var(--s3) 0 0" }}>The recording is deleted on {formatDate(s.audio_delete_on)}. Your score and feedback stay.</p>}
        </>
      ) : (
        <p className="muted small" style={{ margin: "var(--s3) 0 0" }}>Sent on {formatDate(s.submitted_at, true)}. Your teacher will listen and give you points and feedback here.</p>
      )}
    </section>
  );
}

import { useEffect, useId, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon";
import { useToast } from "../../../components/Toasts";
import { Async, FormError, PageHead } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useApi, useTitle } from "../../../lib/hooks";
import { DeleteBox, FieldError, LevelSelect, backTo } from "./parts";

let seed = 0;
const opt = (o = {}) => ({ key: `o${++seed}`, id: o.id ?? null, text: o.text ?? "", is_correct: !!o.is_correct });

export default function QuestionEdit() {
  const { id } = useParams();
  const isNew = !id;
  const options = useApi("/teacher/content/questions/options/");
  const question = useApi(isNew ? null : `/teacher/content/questions/${id}/`);
  useTitle(isNew ? "New question" : "Edit question");
  if (!isNew && (question.loading || question.error)) return <Async state={question}>{() => null}</Async>;
  return (
    <Async state={options}>
      {(o) => <QuestionForm key={id || "new"} topics={o.grammar_topics} initial={question.data?.question} />}
    </Async>
  );
}

function QuestionForm({ topics, initial }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const ids = { prompt: useId(), topic: useId(), explanation: useId(), answer: useId() };
  const [form, setForm] = useState(() => initial
    ? { ...initial, grammar_topic: initial.grammar_topic || "", options: initial.options.map(opt), answers: initial.answers }
    : { level: params.get("level") || "A1", kind: "choice", grammar_topic: "", prompt: "", explanation: "",
        options: [opt(), opt(), opt()], answers: [] });
  const [newAnswer, setNewAnswer] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const levelTopics = topics.filter((t) => t.level === form.level);
  useEffect(() => {
    if (form.grammar_topic && !levelTopics.some((t) => String(t.id) === String(form.grammar_topic))) set({ grammar_topic: "" });
  }, [form.level]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOption = (key, patch) => set({ options: form.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const markRight = (key) => set({ options: form.options.map((o) => ({ ...o, is_correct: o.key === key })) });
  const addAnswer = () => {
    const a = newAnswer.trim();
    if (a && !form.answers.includes(a)) set({ answers: [...form.answers, a] });
    setNewAnswer("");
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const answers = newAnswer.trim() && !form.answers.includes(newAnswer.trim()) ? [...form.answers, newAnswer.trim()] : form.answers;
    const payload = {
      level: form.level, kind: form.kind, grammar_topic: form.grammar_topic ? Number(form.grammar_topic) : null,
      prompt: form.prompt, explanation: form.explanation, answers,
      options: form.options.map(({ id, text, is_correct }) => ({ id, text, is_correct })),
    };
    try {
      const res = initial
        ? await api(`/teacher/content/questions/${initial.id}/`, { method: "PUT", body: payload })
        : await api("/teacher/content/questions/", { method: "POST", body: payload });
      toast(res.message);
      navigate(backTo(res.question.level, "quiz").to);
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      const res = await api(`/teacher/content/questions/${initial.id}/`, { method: "DELETE" });
      toast(res.message);
      navigate(backTo(form.level, "quiz").to);
    } catch (err) { toast(err.message, "error"); }
  };

  const choice = form.kind === "choice";
  const right = form.options.find((o) => o.is_correct);
  return (
    <form onSubmit={save} noValidate>
      <PageHead crumb={backTo(form.level, "quiz")} title={initial ? "Edit question" : "New question"} actions={
        <div className="actions"><button className="btn btn-primary" type="submit" aria-disabled={busy}>{busy ? "Saving…" : "Save question"}</button></div>
      } />
      <div className="editor-split">
        <section className="panel editor-main">
          <FormError error={error} />
          <div className="seg seg-wide" role="group" aria-label="Kind of question">
            <button type="button" aria-pressed={choice} onClick={() => set({ kind: "choice" })}>Multiple choice</button>
            <button type="button" aria-pressed={!choice} onClick={() => set({ kind: "typed" })}>Type the answer</button>
          </div>

          <div className="editor-grid-2">
            <LevelSelect value={form.level} errors={errors} onChange={(level) => set({ level })} />
            <div className={`field${errors.grammar_topic ? " has-error" : ""}`}>
              <label htmlFor={ids.topic}>Grammar topic</label>
              <select id={ids.topic} value={form.grammar_topic} onChange={(e) => set({ grammar_topic: e.target.value })}>
                <option value="">No grammar topic</option>
                {levelTopics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <p className="help">Students can practise a grammar topic's questions on their own.</p>
              <FieldError errors={errors} name="grammar_topic" />
            </div>
          </div>

          <div className={`field${errors.prompt ? " has-error" : ""}`}>
            <label htmlFor={ids.prompt}>Question (German)</label>
            <textarea id={ids.prompt} lang="de" rows={2} value={form.prompt} placeholder="e.g. Was ist die richtige Form? 'Ich ___ Deutsch.' (lernen)"
              onChange={(e) => set({ prompt: e.target.value })} />
            <FieldError errors={errors} name="prompt" />
          </div>

          {choice ? (
            <fieldset className={`field${errors.options ? " has-error" : ""}`}>
              <legend>Answers <span className="muted" style={{ fontWeight: 400 }}>· mark the one that's right</span></legend>
              <div className="option-edit-list">
                {form.options.map((o, i) => (
                  <div key={o.key} className={`option-edit${o.is_correct ? " is-right" : ""}`}>
                    <button type="button" className="right-pick" aria-pressed={o.is_correct} onClick={() => markRight(o.key)}>
                      <Icon name="check" />{o.is_correct ? "Right" : "Mark right"}
                    </button>
                    <input type="text" lang="de" aria-label={`Answer ${i + 1}`} value={o.text} placeholder={`Answer ${i + 1}`}
                      onChange={(e) => setOption(o.key, { text: e.target.value })} />
                    <button type="button" className="icon-btn icon-btn-bad" aria-label={`Remove answer ${i + 1}`}
                      onClick={() => set({ options: form.options.filter((x) => x.key !== o.key) })}><Icon name="x" /></button>
                  </div>
                ))}
              </div>
              <FieldError errors={errors} name="options" />
              {form.options.length < 6 && (
                <div><button className="btn-dashed" type="button" onClick={() => set({ options: [...form.options, opt()] })}><Icon name="plus" />Add an answer</button></div>
              )}
            </fieldset>
          ) : (
            <div className={`field${errors.answers ? " has-error" : ""}`}>
              <label htmlFor={ids.answer}>Accepted answers</label>
              <div className="chip-input">
                {form.answers.map((a) => (
                  <span key={a} className="answer-chip" lang="de">{a}
                    <button type="button" aria-label={`Remove ${a}`} onClick={() => set({ answers: form.answers.filter((x) => x !== a) })}><Icon name="x" /></button>
                  </span>
                ))}
                <input id={ids.answer} type="text" lang="de" value={newAnswer} placeholder={form.answers.length ? "Another one…" : "Type an answer and press Enter"}
                  onChange={(e) => setNewAnswer(e.target.value)} onBlur={addAnswer}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addAnswer(); } }} />
              </div>
              <p className="help">Add every spelling you accept. Capital letters, extra spaces and full stops are ignored; ä, ö, ü and ß count.</p>
              <FieldError errors={errors} name="answers" />
            </div>
          )}

          <div className={`field${errors.explanation ? " has-error" : ""}`}>
            <label htmlFor={ids.explanation}>Explanation</label>
            <textarea id={ids.explanation} lang="de" rows={2} value={form.explanation} placeholder="Why this is the right answer"
              onChange={(e) => set({ explanation: e.target.value })} />
            <p className="help">Optional. Students see it after they answer.</p>
            <FieldError errors={errors} name="explanation" />
          </div>

          {initial && (
            <DeleteBox label="Delete this question" onDelete={remove}>
              It disappears from every quiz. Students in the middle of a quiz simply skip it.
            </DeleteBox>
          )}
        </section>

        <aside className="editor-preview" aria-label="What students see">
          <p className="preview-label"><span aria-hidden="true" />What students see</p>
          <div className="question paper">
            <p className="prompt" lang="de">{form.prompt || <span className="muted">Your question appears here</span>}</p>
            {choice ? (
              <div className="options">
                {form.options.filter((o) => o.text.trim()).map((o) => (
                  <div key={o.key} className={`option${o.is_correct ? " is-right" : ""}`}><span lang="de">{o.text}</span></div>
                ))}
              </div>
            ) : (
              <div className="field"><label>Type your answer</label><input type="text" disabled aria-label="Answer box" /></div>
            )}
            {(choice ? right?.text : form.answers[0]) && (
              <div className="feedback good" style={{ marginTop: "var(--s4)" }}>
                <b>Richtig! That's correct.</b>
                {form.explanation && <p lang="de">{form.explanation}</p>}
              </div>
            )}
          </div>
          <p className="muted small">The green answer is only marked for you. Students find out after they check.</p>
        </aside>
      </div>
    </form>
  );
}

// How a student sees each block of a lesson from the teacher's sections.
// Exercise blocks (choice, spell_word, gap) report their results to the lesson page
// through onResult(blockIndex, right, answered), which adds them up into the lesson's score.
import { Fragment, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import { canSpeak, say } from "../../lib/speech";

export const LETTER_NAMES = {
  A: "ah", B: "beh", C: "tseh", D: "deh", E: "eh", F: "eff", G: "geh", H: "hah", I: "ih", J: "yott", K: "kah",
  L: "ell", M: "emm", N: "enn", O: "oh", P: "peh", Q: "kuh", R: "err", S: "ess", T: "teh", U: "uh", V: "fau",
  W: "weh", X: "iks", Y: "ypsilon", Z: "tsett", Ä: "ä", Ö: "ö", Ü: "ü", ß: "ess-tsett",
};

// "H. A. U. S." is read slowly, letter by letter, by the browser's German voice.
const spelled = (word) => word.toUpperCase().split("").filter((c) => LETTER_NAMES[c]).join(". ") + ".";
const lettersOf = (word) => word.toUpperCase().replace(/ẞ/g, "ß").split("").filter((c) => LETTER_NAMES[c]);

// Plain text with paragraphs (blank line), line breaks and **bold**. No HTML is ever inserted.
export function Rich({ text, className = "" }) {
  if (!text) return null;
  return (
    <div className={`lsn-rich ${className}`}>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line.split(/\*\*(.+?)\*\*/g).map((part, k) => (k % 2 ? <b key={k}>{part}</b> : part))}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function Play({ text, label, big }) {
  if (!canSpeak) return null;
  return (
    <button className={big ? "lsn-play" : "lsn-play-small"} type="button" aria-label={label || `Listen: ${text}`}
      onClick={() => say(text)}>
      <Icon name="play" />
    </button>
  );
}

function Feedback({ ok, children }) {
  return (
    <div className={`lsn-feedback ${ok ? "is-right" : "is-wrong"}`} role="status">
      <b>{ok ? "Richtig!" : "Not quite."}</b> {children}
    </div>
  );
}

// ---------------- reading blocks ----------------
function Tiles({ b }) {
  const [on, setOn] = useState(null);
  return (
    <>
      <Rich text={b.intro} className="lsn-intro" />
      <div className={`lsn-tiles${b.items.some((t) => t.note) ? " lsn-tiles-wide" : ""}`} lang="de">
        {b.items.map((t, i) => (
          <button key={i} type="button" className="lsn-tile" aria-pressed={on === i}
            aria-label={`Listen: ${t.big}${t.small ? `, said ${t.small}` : ""}`}
            onClick={() => { setOn(i); say(t.say || t.big); }}>
            <span className="lsn-tile-big">{t.big}{t.big.length === 1 && t.big !== "ß" && <small>{t.big.toLowerCase()}</small>}</span>
            {t.small && <span className="lsn-tile-small">{t.small}</span>}
            {t.note && <span className="lsn-tile-note">as in <b>{t.note}</b></span>}
          </button>
        ))}
      </div>
    </>
  );
}

function Sounds({ b }) {
  return (
    <>
      <Rich text={b.intro} className="lsn-intro" />
      <div className="lsn-card lsn-rules">
        {b.rows.map((r, i) => (
          <div className="lsn-rule" key={i}>
            <b className="lsn-rule-label" lang="de">{r.label}</b>
            <span className="lsn-rule-text">{r.rule}</span>
            <span className="lsn-rule-words" lang="de">
              {r.words.map((w) => (
                <button key={w} type="button" className="lsn-chip" onClick={() => say(w)} aria-label={`Listen: ${w}`}>
                  <span className="lsn-chip-dot"><Icon name="play" /></span>{w}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function SpellDemo({ b }) {
  return (
    <>
      <Rich text={b.intro} className="lsn-intro" />
      <div className="lsn-card lsn-spell-demo">
        <Play text={spelled(b.word)} label={`Listen: ${b.word}, spelled`} />
        <b className="lsn-spell-word">{b.word.toUpperCase()}</b>
        <span className="muted" aria-hidden="true">→</span>
        <span className="lsn-letter-row" lang="de">
          {lettersOf(b.word).map((c, i) => <span key={i} className="lsn-letter-name">{LETTER_NAMES[c]}</span>)}
        </span>
      </div>
    </>
  );
}

function SpellName() {
  const id = useId();
  const [name, setName] = useState("");
  const letters = lettersOf(name);
  const shown = name.trim() ? name.trim()[0].toUpperCase() + name.trim().slice(1) : "…";
  return (
    <div className="lsn-card lsn-spell-name">
      <div className="field">
        <label htmlFor={id}>Type your name to see how to spell it</label>
        <input id={id} type="text" autoComplete="given-name" spellCheck={false} value={name} maxLength={40}
          onChange={(e) => setName(e.target.value)} />
      </div>
      {letters.length > 0 && (
        <div className="lsn-name-chips" lang="de">
          {letters.map((c, i) => (
            <button key={i} type="button" className="lsn-name-chip" onClick={() => say(c)} aria-label={`Listen: ${c}`}>
              <b>{c}</b><span>{LETTER_NAMES[c]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="lsn-say-this">
        <span className="muted small">What to say</span>
        <p lang="de">„Ich heiße <b>{shown}</b>. Ich buchstabiere: <b>{letters.length ? letters.join(" – ") : "…"}</b>.“</p>
        {letters.length > 0 && <Play text={`Ich heiße ${name.trim()}. Ich buchstabiere: ${spelled(name)}`} label="Listen to the whole sentence" />}
      </div>
    </div>
  );
}

// ---------------- exercises ----------------
// One question at a time, with a "Next" button and a short result at the end.
function useSteps(count, onResult) {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState([]); // true/false per answered item
  const right = results.filter(Boolean).length;
  useEffect(() => { onResult(right, results.length); }, [right, results.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    step, done: step >= count, results, right,
    answer: (ok) => setResults((r) => (r.length > step ? r : [...r, ok])),
    answered: results.length > step,
    next: () => setStep((s) => s + 1),
    restart: () => { setStep(0); setResults([]); },
  };
}

function Progress({ step, count }) {
  return <span className="lsn-count">{Math.min(step + 1, count)} of {count}</span>;
}

function Done({ right, count, onAgain }) {
  return (
    <div className={`lsn-done${right === count ? " is-perfect" : ""}`}>
      <span><b>{right === count ? "Perfekt!" : "Done:"}</b> {right} of {count} right.</span>
      <button className="btn btn-secondary btn-small" type="button" onClick={onAgain}><Icon name="again" />Try again</button>
    </div>
  );
}

function Choice({ b, onResult }) {
  const s = useSteps(b.items.length, onResult);
  const [picked, setPicked] = useState(null);
  const item = b.items[Math.min(s.step, b.items.length - 1)];
  useEffect(() => { setPicked(null); }, [s.step]);
  const pick = (i) => { if (picked !== null) return; setPicked(i); s.answer(i === item.answer); };
  if (s.done) return <Done right={s.right} count={b.items.length} onAgain={s.restart} />;
  return (
    <div className="lsn-exercise">
      {b.items.length > 1 && <Progress step={s.step} count={b.items.length} />}
      <div className="lsn-question">
        {item.say && <Play big text={item.say} label="Play" />}
        {item.prompt && <p className="lsn-prompt" lang="de">{item.prompt}</p>}
      </div>
      <div className={`lsn-options${item.options.every((o) => o.length <= 3) ? " lsn-options-big" : ""}`} lang="de">
        {item.options.map((o, i) => {
          const state = picked === null ? "" : i === item.answer ? "is-right" : i === picked ? "is-wrong" : "";
          return <button key={i} type="button" className={`lsn-option ${state}`} onClick={() => pick(i)} aria-disabled={picked !== null}>{o}</button>;
        })}
      </div>
      {picked !== null && (
        <div className="lsn-after">
          <Feedback ok={picked === item.answer}>{item.explain || (picked === item.answer ? "" : `It's “${item.options[item.answer]}”.`)}</Feedback>
          <button className="btn btn-primary btn-small" type="button" onClick={s.next}>{s.step + 1 < b.items.length ? "Next" : "Finish"}<Icon name="chevron" /></button>
        </div>
      )}
    </div>
  );
}

function SpellWord({ b, onResult }) {
  const id = useId();
  const s = useSteps(b.items.length, onResult);
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const word = b.items[Math.min(s.step, b.items.length - 1)].word;
  useEffect(() => { setValue(""); setResult(null); }, [s.step]);
  const check = (e) => {
    e.preventDefault();
    if (result !== null) { s.next(); return; }
    if (!value.trim()) return;
    const ok = value.trim().toLowerCase() === word.toLowerCase();
    setResult(ok);
    s.answer(ok);
    if (ok) say(word);
  };
  if (s.done) return <Done right={s.right} count={b.items.length} onAgain={s.restart} />;
  return (
    <form className="lsn-exercise" onSubmit={check} noValidate>
      {b.items.length > 1 && <Progress step={s.step} count={b.items.length} />}
      <div className="lsn-question lsn-spell-row">
        <Play big text={spelled(word)} label="Play the spelling" />
        <div className={`field lsn-spell-field${result === false ? " has-error" : ""}`}>
          <label htmlFor={id}>The word</label>
          <input id={id} type="text" lang="de" autoComplete="off" autoCapitalize="off" spellCheck={false} value={value}
            readOnly={result !== null} onChange={(e) => setValue(e.target.value)}
            className={result === true ? "is-right" : result === false ? "is-wrong" : ""} />
        </div>
        <button className="btn btn-primary" type="submit">{result === null ? "Check" : s.step + 1 < b.items.length ? "Next" : "Finish"}</button>
      </div>
      {result !== null && (
        <Feedback ok={result}><span lang="de">{result ? word : `It was ${word}: ${lettersOf(word).join(" · ")}`}</span></Feedback>
      )}
    </form>
  );
}

function Gap({ b, onResult }) {
  const [picks, setPicks] = useState({});
  const answered = Object.keys(picks).length;
  const right = b.items.filter((it, i) => picks[i] === it.answer).length;
  useEffect(() => { onResult(right, answered); }, [right, answered]); // eslint-disable-line react-hooks/exhaustive-deps
  const full = (it, choice) => it.text.replace("_", choice);
  return (
    <div className="lsn-exercise">
      <Rich text={b.intro} className="lsn-intro" />
      <div className="lsn-gaps">
        {b.items.map((it, i) => {
          const got = picks[i];
          const state = got === undefined ? "" : got === it.answer ? "is-right" : "is-wrong";
          return (
            <div key={i} className={`lsn-gap ${state}`}>
              <Play text={full(it, it.answer)} label="Listen" />
              <b lang="de" className="lsn-gap-word">{got === undefined ? it.text.replace("_", "__") : full(it, it.answer)}</b>
              <span className="lsn-gap-choices" lang="de">
                {b.choices.map((c) => (
                  <button key={c} type="button" className="lsn-gap-choice" aria-pressed={got === c} aria-disabled={got !== undefined}
                    aria-label={`${c} for ${it.text.replace("_", " blank ")}`}
                    onClick={() => { if (got !== undefined) return; setPicks({ ...picks, [i]: c }); say(full(it, it.answer)); }}>{c}</button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      {answered === b.items.length && <Done right={right} count={b.items.length} onAgain={() => setPicks({})} />}
    </div>
  );
}

// ---------------- the list of blocks ----------------
export default function Blocks({ blocks, onResult }) {
  return blocks.map((b, i) => {
    const report = (right, answered) => onResult?.(i, right, answered);
    let body = null;
    switch (b.type) {
      case "text": body = <Rich text={b.body} className="lsn-text" />; break;
      case "tip": body = <div className="lsn-tip"><Icon name="bulb" /><Rich text={b.body} /></div>; break;
      case "table": body = (
        <div className="lsn-table-wrap">
          <table className="lsn-table" lang="de">
            <thead><tr>{b.headers.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => (k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody>
          </table>
        </div>
      ); break;
      case "words": body = (
        <ul className="lsn-card lsn-words">
          {b.items.map((w, j) => (
            <li key={j}><Play text={w.german} /><b lang="de">{w.german}</b><span className="muted">{w.english}</span></li>
          ))}
        </ul>
      ); break;
      case "tiles": body = <Tiles b={b} />; break;
      case "sounds": body = <Sounds b={b} />; break;
      case "spell_demo": body = <SpellDemo b={b} />; break;
      case "spell_name": body = <SpellName />; break;
      case "choice": body = <Choice b={b} onResult={report} />; break;
      case "spell_word": body = <SpellWord b={b} onResult={report} />; break;
      case "gap": body = <Gap b={b} onResult={report} />; break;
      case "video": body = (
        <Link className="lsn-link-card" to={`/videos/${b.video.id}`}>
          <span className="lsn-link-icon"><Icon name="videos" /></span>
          <span><b>{b.video.title}</b><span className="muted small">Watch the video</span></span>
          <Icon name="chevron" />
        </Link>
      ); break;
      case "speaking": body = (
        <Link className="lsn-link-card" to={`/speaking/${b.task.level}/${b.task.slug}`}>
          <span className="lsn-link-icon"><Icon name="speaking" /></span>
          <span><b lang="de">{b.task.title}</b><span className="muted small">{b.task.brief} · Record it for your teacher</span></span>
          <Icon name="chevron" />
        </Link>
      ); break;
      default: return null;
    }
    const exercise = ["choice", "spell_word", "gap"].includes(b.type);
    return (
      <section key={i} className={`lsn-block lsn-block-${b.type}${exercise ? " lsn-is-exercise" : ""}`}>
        {b.heading && <h2 className="lsn-heading">{b.heading}</h2>}
        {body}
      </section>
    );
  });
}

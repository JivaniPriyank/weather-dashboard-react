import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Empty, PageHead, SayButton } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";

export default function Study() {
  const { level, slug } = useParams();
  const [round, setRound] = useState(0); // "Study again" loads a fresh session
  const state = useApi(`/decks/${level}/${slug}/session/`, [round]);
  useTitle(state.data ? `Study ${state.data.deck.name}` : "Study");
  return (
    <div className="study">
      <Async state={state}>
        {({ deck, cards }) => (
          <>
            <PageHead crumb={{ to: `/words/${level}/${slug}`, label: deck.name }} title="Study" />
            {cards.length ? (
              <Session key={round} cards={cards} onAgain={() => setRound((r) => r + 1)} />
            ) : (
              <Empty title="Nothing to study in this deck right now" action={<Link className="btn btn-primary" to="/words">Choose another deck</Link>}>
                You've reviewed every word that's due. The next ones come back on their own schedule.
              </Empty>
            )}
          </>
        )}
      </Async>
    </div>
  );
}

function Session({ cards, onAgain }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [knew, setKnew] = useState(0);
  const [error, setError] = useState(null);
  const knewBtn = useRef(null);
  const done = index >= cards.length;
  const card = cards[Math.min(index, cards.length - 1)];

  const flip = useCallback(() => {
    if (busy || done) return;
    setFlipped((f) => !f);
  }, [busy, done]);

  const answer = useCallback(async (value) => {
    if (busy || !flipped || done) return;
    setBusy(true);
    setError(null);
    try {
      await api("/review/", { method: "POST", body: { item: card.id, knew: value } });
      if (value) setKnew((k) => k + 1);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (e) {
      setError(`${e.message} Your answer wasn't saved. Press the button again.`);
    }
    setBusy(false);
  }, [busy, flipped, done, card]);

  useEffect(() => { if (flipped) knewBtn.current?.focus({ preventScroll: true }); }, [flipped]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if ((e.key === " " || e.key === "Enter") && !flipped && !done) { e.preventDefault(); flip(); }
      else if (e.key === "1") answer(false);
      else if (e.key === "2") answer(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flip, answer, flipped, done]);

  if (done) {
    const missed = cards.length - knew;
    return (
      <div className="panel study-done">
        <div className="big">{knew} / {cards.length}</div>
        <h2 className="my-3">Session finished</h2>
        <p className="muted">{missed === 0 ? "You knew every word. They'll come back in a few days to make sure they stick." : `${missed} word${missed === 1 ? "" : "s"} will come back in your next session.`}</p>
        <div className="actions justify-center mt-5">
          <button className="btn btn-primary" type="button" onClick={onAgain}>Study again</button>
          <Link className="btn btn-secondary" to="/words">Choose another deck</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="study-top">
        <div className="meter" role="progressbar" aria-label="Cards done" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={index}>
          <span style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
        <span className="muted small nowrap">{index + 1} of {cards.length}</span>
      </div>

      <div className="card-stage">
        <div className={`flashcard${flipped ? " is-flipped" : ""}${card.article ? ` gender-${card.article}` : ""}`} onClick={() => !flipped && flip()} aria-live="polite">
          <div className="face face-front paper">
            {card.is_new && <span className="badge badge-note new-tag">New word</span>}
            <SayButton text={card.display} label="Listen" />
            <span className="article" lang="de">{card.article}</span>
            <span className="german" lang="de">{card.german}</span>
            <span className="hint">Tap the card or press Space to see the meaning</span>
          </div>
          <div className="face face-back paper">
            <span className="english">{card.english}</span>
            <span className="card-example" lang="de">{card.example}</span>
          </div>
        </div>
      </div>

      {!flipped ? (
        <div className="study-flip"><button className="btn btn-primary btn-block" type="button" onClick={flip}>Show meaning</button></div>
      ) : (
        <div className="study-actions">
          <button className="btn btn-bad" type="button" onClick={() => answer(false)} aria-disabled={busy}><Icon name="x" />Not yet</button>
          <button className="btn btn-good" type="button" ref={knewBtn} onClick={() => answer(true)} aria-disabled={busy}><Icon name="check" />I knew it</button>
        </div>
      )}
      <p className="kbd-hint">Keyboard: <kbd>Space</kbd> turn over, <kbd>1</kbd> not yet, <kbd>2</kbd> I knew it</p>
      {error && <p className="form-errors" role="alert">{error}</p>}
    </>
  );
}

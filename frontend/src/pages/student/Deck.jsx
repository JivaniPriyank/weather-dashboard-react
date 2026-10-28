import { Link, useParams } from "react-router-dom";
import { Article, Async, PageHead, SayButton } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { plural } from "../../lib/speech";

export default function Deck() {
  const { level, slug } = useParams();
  const state = useApi(`/decks/${level}/${slug}/`);
  useTitle(state.data?.deck.name);
  return (
    <Async state={state}>
      {({ deck, words }) => (
        <>
          <PageHead crumb={{ to: "/words", label: "Words" }} title={deck.name}
            actions={deck.stats.due
              ? <Link className="btn btn-primary" to={`/words/${level}/${slug}/study`}>Study {plural(deck.stats.due, "card")}</Link>
              : <span className="badge badge-good">All reviewed for now</span>}>
            <p className="muted">{deck.description}. {deck.stats.learned} of {deck.stats.total} learned.</p>
          </PageHead>
          <ul className="list word-list">
            {words.map((w) => (
              <li className="row" key={w.id}>
                <div className="row-main">
                  <div className="word-de"><Article article={w.article} />{w.german}</div>
                  <div className="word-en">{w.english}</div>
                  {w.example && <div className="word-ex" lang="de">{w.example}</div>}
                </div>
                <div className="row-end">
                  {w.box ? (
                    <span className="box-dots" role="img" aria-label={`Box ${w.box} of 5`}>
                      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= w.box ? "on" : ""} />)}
                    </span>
                  ) : <span className="badge">New</span>}
                  <SayButton text={`${w.display}${w.example ? ". " + w.example : ""}`} label={`Listen to ${w.display}`} />
                </div>
              </li>
            ))}
            {!words.length && <li className="row"><span className="muted">This deck has no words yet.</span></li>}
          </ul>
        </>
      )}
    </Async>
  );
}

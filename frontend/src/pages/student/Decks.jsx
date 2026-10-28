import { Link } from "react-router-dom";
import { Async, Empty, Meter, PageHead } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";

export default function Decks() {
  useTitle("Words");
  const state = useApi("/decks/", [useLevelKey()]);
  return (
    <Async state={state}>
      {({ level, decks }) => (
        <>
          <PageHead title="Words"><p className="muted">{level.code} topic decks. Study a deck and the words you miss come back sooner.</p></PageHead>
          {decks.length ? (
            <div className="deck-grid">
              {decks.map((d) => (
                <Link key={d.slug} className="deck" to={`/words/${d.level}/${d.slug}`}>
                  <h2>{d.name}</h2>
                  <span className="muted small">{d.description}</span>
                  <Meter percent={d.stats.percent} practised={d.stats.practised_percent}
                    label={`${d.stats.seen} of ${d.stats.total} practised, ${d.stats.learned} learned for good`} />
                  <div className="meta">
                    <span>{d.stats.seen} of {d.stats.total} practised{d.stats.learned ? ` · ${d.stats.learned} learned` : ""}</span>
                    {d.stats.due ? <span className="badge badge-royal">{d.stats.due} ready</span> : <span className="badge badge-good">Up to date</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title={`No word decks for ${level.code} yet`}>Your teacher hasn't added words at this level. Switch level at the top, or check back later.</Empty>
          )}
        </>
      )}
    </Async>
  );
}

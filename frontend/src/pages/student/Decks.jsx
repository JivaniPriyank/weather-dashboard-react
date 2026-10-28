import { Link, useSearchParams } from "react-router-dom";
import { Async, Empty, Meter, PageHead } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";

// Filters for the deck list. The choice is kept in the address (?show=ready&q=…),
// so the back button returns to the same view.
const FILTERS = [
  { value: "all", label: "All", test: () => true },
  { value: "ready", label: "Ready to study", test: (s) => s.due > 0 },
  { value: "new", label: "Not started", test: (s) => s.seen === 0 },
  { value: "progress", label: "In progress", test: (s) => s.seen > 0 && s.learned < s.total },
  { value: "learned", label: "Learned", test: (s) => s.total > 0 && s.learned === s.total },
];

const fold = (text) => (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

export default function Decks() {
  useTitle("Words");
  const state = useApi("/decks/", [useLevelKey()]);
  const [params, setParams] = useSearchParams();
  const show = FILTERS.find((f) => f.value === params.get("show")) || FILTERS[0];
  const query = params.get("q") || "";
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v && v !== "all" ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  return (
    <Async state={state}>
      {({ level, decks }) => {
        const q = fold(query.trim());
        const shown = decks.filter((d) => show.test(d.stats) && (!q || fold(`${d.name} ${d.description}`).includes(q)));
        return (
          <>
            <PageHead title="Words"><p className="muted">{level.code} topic decks. Study a deck and the words you miss come back sooner.</p></PageHead>
            {decks.length ? (
              <>
                <div className="deck-filters">
                  <input type="search" aria-label="Search decks" placeholder="Search decks, e.g. Familie" value={query}
                    onChange={(e) => update({ q: e.target.value })} />
                  <div className="chips" role="group" aria-label="Show">
                    {FILTERS.map((f) => (
                      <button key={f.value} type="button" className="chip" aria-pressed={f.value === show.value} onClick={() => update({ show: f.value })}>
                        {f.label} <span className="chip-count">{decks.filter((d) => f.test(d.stats)).length}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="visually-hidden" role="status">{shown.length} of {decks.length} decks shown</p>
                {shown.length ? (
                  <div className="deck-grid">
                    {shown.map((d) => (
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
                  <Empty title="No decks match" action={<button className="btn btn-secondary" type="button" onClick={() => update({ show: "all", q: "" })}>Show all decks</button>}>
                    {query ? `Nothing called “${query}”` : "No decks"}{show.value !== "all" ? ` under “${show.label}”` : ""}.
                  </Empty>
                )}
              </>
            ) : (
              <Empty title={`No word decks for ${level.code} yet`}>Your teacher hasn't added words at this level. Switch level at the top, or check back later.</Empty>
            )}
          </>
        );
      }}
    </Async>
  );
}

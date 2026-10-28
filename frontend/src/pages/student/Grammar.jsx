import { Async, Empty, PageHead, RowLink } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";

export default function Grammar() {
  useTitle("Grammar");
  const state = useApi("/grammar/", [useLevelKey()]);
  return (
    <Async state={state}>
      {({ level, topics }) => (
        <>
          <PageHead title="Grammar"><p className="muted">The {level.code} rules, with tables and examples. Each topic has a quiz to check yourself.</p></PageHead>
          {topics.length ? (
            <ul className="list">
              {topics.map((t) => (
                <RowLink key={t.slug} to={`/grammar/${t.level}/${t.slug}`} title={t.title} lang="de"
                  sub={t.summary.length >= 140 ? t.summary.slice(0, 110) + "…" : t.summary}
                  end={t.questions ? <span className="badge">{t.questions} questions</span> : null} />
              ))}
            </ul>
          ) : (
            <Empty title={`No grammar topics for ${level.code} yet`}>Switch level at the top, or check back later.</Empty>
          )}
        </>
      )}
    </Async>
  );
}

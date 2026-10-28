import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Empty, PageHead } from "../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../lib/hooks";

export default function Speaking() {
  useTitle("Speaking");
  const state = useApi("/speaking/", [useLevelKey()]);
  const [params, setParams] = useSearchParams();
  const part = params.get("part") || "";
  return (
    <Async state={state}>
      {({ level, parts, tasks }) => {
        const shown = part ? tasks.filter((t) => t.part === part) : tasks;
        return (
          <>
            <PageHead title="Speaking"><p className="muted">{level.code} tasks in the Goethe exam format. Record your answer and your teacher gives you points and feedback.</p></PageHead>
            {parts.length > 1 && (
              <nav className="chips" aria-label="Filter by exam part">
                <button type="button" className="chip" aria-current={!part} onClick={() => setParams({})}>All</button>
                {parts.map((p) => (
                  <button type="button" key={p.value} className="chip" aria-current={part === p.value} onClick={() => setParams({ part: p.value })}>{p.label}</button>
                ))}
              </nav>
            )}
            {shown.length ? (
              <ul className="list">
                {shown.map((t) => (
                  <li key={t.slug}>
                    <Link className="row" to={`/speaking/${t.level}/${t.slug}`}>
                      <span className="row-main task-card">
                        <span>
                          <span className="badge badge-royal">{t.part_label}</span>{" "}
                          {t.submission?.reviewed ? <span className="badge badge-good">Feedback: {t.submission.total_score}/{t.submission.max_score}</span>
                            : t.submission ? <span className="badge badge-note">Sent</span>
                            : t.practised ? <span className="badge badge-good">Practised</span> : null}
                        </span>
                        <span className="row-title" lang="de">{t.title}</span>
                        <span className="row-sub">{t.brief}</span>
                      </span>
                      <span className="row-end"><span className="nowrap">{t.minutes} min</span><span className="chev"><Icon name="chevron" /></span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No speaking tasks here yet">Your teacher hasn't added speaking tasks for this choice. Try another level or part.</Empty>
            )}
          </>
        );
      }}
    </Async>
  );
}

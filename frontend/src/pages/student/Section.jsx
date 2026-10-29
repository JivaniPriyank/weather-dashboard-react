import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Empty, Meter } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";

// One of the teacher's sections, e.g. "Basics of A1": its lessons in order.
export default function Section() {
  const { id } = useParams();
  const state = useApi(`/sections/${id}/`);
  useTitle(state.data?.section.title);
  return (
    <Async state={state}>
      {({ section, lessons, done }) => (
        <div className="lsn-page">
          <div className="lsn-section-head">
            <span className="lsn-section-icon"><Icon name={section.icon} /></span>
            <div>
              <h1>{section.title}</h1>
              {section.description && <p className="muted">{section.description}</p>}
            </div>
          </div>
          {lessons.length > 0 && (
            <div className="lsn-section-progress">
              <span>{done} of {lessons.length} lesson{lessons.length === 1 ? "" : "s"} done</span>
              <Meter good percent={Math.round((done / lessons.length) * 100)} label={`${done} of ${lessons.length} lessons done`} />
            </div>
          )}
          {lessons.length ? (
            <ol className="lsn-lessons">
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link className="lsn-lesson-row" to={`/sections/${section.id}/lessons/${l.id}`}>
                    <span className={`lsn-lesson-num${l.done ? " is-done" : ""}`}>{l.done ? <Icon name="check" label="Done" /> : i + 1}</span>
                    <span className="lsn-lesson-main">
                      <b lang="de">{l.title}</b>
                      <span className={l.done ? "lsn-done-text" : "muted"}>
                        {l.done ? (l.total ? `Done · ${l.score} of ${l.total} right` : "Done") : l.exercises ? `${l.exercises} exercises` : "Read and listen"}
                        {!l.is_published && " · Draft (only you see it)"}
                      </span>
                    </span>
                    <span className="chev"><Icon name="chevron" /></span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No lessons yet">Your teacher is still preparing this section.</Empty>
          )}
        </div>
      )}
    </Async>
  );
}

import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Empty, PageHead } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function Videos() {
  useTitle("Videos");
  const { user, levels } = useSession();
  const [params, setParams] = useSearchParams();
  const level = params.get("level") || "";
  const state = useApi(`/videos/${level ? `?level=${level}` : ""}`);
  return (
    <>
      <PageHead title="Videos" actions={user.is_teacher && <Link className="btn btn-primary" to="/teacher/videos/new"><Icon name="upload" />Add a video</Link>}>
        <p className="muted">Lessons recorded by your teacher.</p>
      </PageHead>
      {levels.length > 1 && (
        <nav className="chips" aria-label="Filter by level">
          <button type="button" className="chip" aria-current={!level} onClick={() => setParams({})}>All levels</button>
          {levels.map((lv) => <button type="button" key={lv.code} className="chip" aria-current={level === lv.code} onClick={() => setParams({ level: lv.code })}>{lv.code}</button>)}
        </nav>
      )}
      <Async state={state}>
        {({ videos }) => videos.length ? (
          <div className="video-grid">
            {videos.map((v) => (
              <Link key={v.id} className="video-card" to={`/videos/${v.id}`}>
                <div className="video-thumb">
                  <Icon name="play" />
                  {v.watched ? <span className="badge badge-good">Watched</span> : !v.is_published && <span className="badge badge-note">Hidden</span>}
                </div>
                <div className="video-body">
                  <h2>{v.title}</h2>
                  <span className="muted small">{v.grammar_topic ? v.grammar_topic.title : v.level || "All levels"}{v.classroom ? `, class ${v.classroom}` : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No videos yet" action={user.is_teacher && <Link className="btn btn-primary" to="/teacher/videos/new">Add your first video</Link>}>
            {user.is_teacher ? "Upload a lesson or paste a YouTube link. Your students will see it here." : "When your teacher shares a video lesson, it appears here."}
          </Empty>
        )}
      </Async>
    </>
  );
}

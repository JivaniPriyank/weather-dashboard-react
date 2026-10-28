import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { Async, PageHead } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function VideoDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const state = useApi(`/videos/${id}/`);
  useTitle(state.data?.video.title);

  const markWatched = async (silent) => {
    if (user.is_teacher || state.data?.video.watched) return;
    try {
      await api(`/videos/${id}/watched/`, { method: "POST" });
      state.setData((d) => ({ ...d, video: { ...d.video, watched: true } }));
      if (!silent) toast("Marked as watched.");
    } catch (e) {
      if (!silent) toast(e.message, "error");
    }
  };

  return (
    <Async state={state}>
      {({ video }) => (
        <>
          <PageHead crumb={{ to: "/videos", label: "Videos" }} title={video.title}
            actions={user.is_teacher && <Link className="btn btn-secondary" to={`/teacher/videos/${video.id}`}><Icon name="edit" />Edit</Link>}>
            <p className="muted">
              {video.grammar_topic ? <Link to={`/grammar/${video.grammar_topic.level}/${video.grammar_topic.slug}`}>{video.grammar_topic.title}</Link> : video.level || "All levels"}
            </p>
          </PageHead>
          <div className="video-frame">
            {video.stream_url ? (
              <video controls preload="metadata" playsInline controlsList="nodownload" src={video.stream_url} onEnded={() => markWatched(true)}>
                Your browser can't play this video. Try Chrome, Edge, Firefox or Safari.
              </video>
            ) : (
              <iframe src={video.embed_url} title={video.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
            )}
          </div>
          <div className="split mt-5">
            <div>{video.description && <p className="pre-line">{video.description}</p>}</div>
            {!user.is_teacher && (
              <div className="panel">
                {video.watched ? <span className="badge badge-good">Watched</span> : (
                  <>
                    <p className="mb-3"><span className="badge">Not watched yet</span></p>
                    <button className="btn btn-secondary btn-block" type="button" onClick={() => markWatched(false)}><Icon name="check" />Mark as watched</button>
                    {video.stream_url && <p className="help small muted mt-2">It's marked automatically when the video finishes.</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Async>
  );
}

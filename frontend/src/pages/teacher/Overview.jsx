import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { Async, Empty, scoreClass } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useOnNewActivity } from "../../lib/live";
import { useSession } from "../../lib/session";
import { formatDate, plural } from "../../lib/speech";
import RequestItem from "./RequestItem";

export default function Overview() {
  useTitle("Overview");
  const { user } = useSession();
  const state = useApi("/teacher/overview/");
  useOnNewActivity(state.reload, ["requests", "speaking"]);
  return (
    <Async state={state}>
      {(d) => (
        <>
          <div className="greeting">
            <h1>Hallo, {user.first_name}!</h1>
            <p className="muted">{d.pending_count ? `${plural(d.pending_count, "student")} waiting for you to approve them.` : "No one is waiting for approval."}</p>
          </div>

          {d.speaking_waiting > 0 && (
            <div className="notice notice-royal">
              {plural(d.speaking_waiting, "speaking answer")} waiting for your feedback. <Link to="/teacher/speaking">Listen now</Link>
            </div>
          )}

          {d.pending.length > 0 && (
            <section>
              <div className="section-head"><h2>Waiting for approval</h2><Link to="/teacher/requests">All requests</Link></div>
              <ul className="list">{d.pending.map((r) => <RequestItem key={r.id} request={r} classrooms={d.classrooms} onDone={state.reload} />)}</ul>
            </section>
          )}

          <section className="section">
            <h2 className="visually-hidden">At a glance</h2>
            <div className="teach-cards">
              <TeachCard to="/teacher/students" icon="users" value={d.student_count} label="approved students" />
              <TeachCard to="/teacher/classes" icon="classes" value={d.class_count} label="classes" />
              <TeachCard to="/teacher/videos" icon="videos" value={d.video_count} label="videos" />
              <TeachCard to="/teacher/content" icon="edit" value={d.content.words} label={`words, ${d.content.questions} questions`} />
            </div>
          </section>

          <section className="section">
            <h2>Latest quiz results</h2>
            {d.recent.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th scope="col">Student</th><th scope="col">Quiz</th><th scope="col">Score</th><th scope="col">When</th></tr></thead>
                  <tbody>
                    {d.recent.map((a) => (
                      <tr key={a.id}>
                        <td><Link to={`/teacher/students/${a.student.id}`}>{a.student.full_name}</Link></td>
                        <td>{a.title}</td>
                        <td><span className={`badge ${scoreClass(a.score, a.total)}`}>{a.score}/{a.total}</span></td>
                        <td className="nowrap">{formatDate(a.finished_at, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="No quizzes finished yet">Results appear here as soon as your students finish a quiz.</Empty>}
          </section>

          <section className="section">
            <h2>Quick actions</h2>
            <div className="actions">
              <Link className="btn btn-primary" to="/teacher/videos/new"><Icon name="upload" />Add a video</Link>
              <Link className="btn btn-secondary" to="/teacher/classes">Create a class</Link>
              <Link className="btn btn-secondary" to="/teacher/content?tab=words">Add words</Link>
              <Link className="btn btn-secondary" to="/teacher/content/questions/new">Add a quiz question</Link>
            </div>
          </section>
        </>
      )}
    </Async>
  );
}

function TeachCard({ to, href, icon, value, label }) {
  const inner = (
    <>
      <span className="teach-card-icon"><Icon name={icon} /></span>
      <b>{value}</b>
      <span className="teach-card-label">{label}</span>
      <span className="teach-card-go"><Icon name="chevron" /></span>
    </>
  );
  return to
    ? <Link className="teach-card" to={to}>{inner}</Link>
    : <a className="teach-card" href={href}>{inner}</a>;
}

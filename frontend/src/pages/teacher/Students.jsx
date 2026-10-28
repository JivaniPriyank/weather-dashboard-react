import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Async, Empty, PageHead } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useReloadWhileOpen } from "../../lib/live";
import { formatDate } from "../../lib/speech";

export default function Students() {
  useTitle("Students");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cls = params.get("class") || "";
  const page = params.get("page") || "1";
  const [search, setSearch] = useState(q);
  const state = useApi(`/teacher/students/?${new URLSearchParams({ q, class: cls, page })}`);
  useReloadWhileOpen(state.reload);
  const go = (next) => setParams(Object.fromEntries(Object.entries({ q, class: cls, ...next }).filter(([, v]) => v)));

  return (
    <>
      <PageHead title="Students"><p className="muted">Everyone you've approved. Open a student to see their progress or change their class.</p></PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); go({ q: search, page: "" }); }}>
              <label className="visually-hidden" htmlFor="q">Search by name or email</label>
              <input type="search" id="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
              <label className="visually-hidden" htmlFor="class">Class</label>
              <select id="class" value={cls} onChange={(e) => go({ class: e.target.value, page: "" })}>
                <option value="">All classes</option>
                <option value="none">No class</option>
                {d.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-secondary btn-small" type="submit">Search</button>
              {(q || cls) && <button className="btn btn-quiet btn-small" type="button" onClick={() => { setSearch(""); setParams({}); }}>Clear</button>}
            </form>
            {d.students.length ? (
              <>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th scope="col">Name</th><th scope="col">Level</th><th scope="col">Class</th><th scope="col">Words practised</th><th scope="col">Quizzes</th><th scope="col">Last active</th></tr></thead>
                    <tbody>
                      {d.students.map((u) => (
                        <tr key={u.id}>
                          <td><Link to={`/teacher/students/${u.id}`}><b>{u.full_name}</b></Link><br /><span className="muted small">{u.email}</span>
                            {!u.is_active && <> <span className="badge badge-bad">Switched off</span></>}</td>
                          <td>{u.level ? <span className="badge badge-royal">{u.level.code}</span> : <span className="badge badge-note">Not set</span>}</td>
                          <td>{u.classroom?.name || "–"}</td>
                          <td className="words-by-level">{u.words_by_level.map((w) => (
                            <span key={w.code}><b>{w.code}</b> {w.practised} / {w.total}</span>
                          ))}</td>
                          <td>{u.quizzes}</td>
                          <td className="nowrap">{u.last_active ? formatDate(u.last_active, true) : <span className="muted">Not yet</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {d.page.pages > 1 && (
                  <nav className="pager" aria-label="Pages">
                    {d.page.has_previous && <button className="btn btn-secondary btn-small" type="button" onClick={() => go({ page: String(d.page.number - 1) })}>Previous</button>}
                    <span className="muted">Page {d.page.number} of {d.page.pages}</span>
                    {d.page.has_next && <button className="btn btn-secondary btn-small" type="button" onClick={() => go({ page: String(d.page.number + 1) })}>Next</button>}
                  </nav>
                )}
              </>
            ) : q || cls ? (
              <Empty title="No students match">Try a different name or class.</Empty>
            ) : (
              <Empty title="No approved students yet" action={<Link className="btn btn-primary" to="/teacher/requests">Open access requests</Link>}>
                Share the website with your class. Their access requests appear under Access requests.
              </Empty>
            )}
          </>
        )}
      </Async>
    </>
  );
}

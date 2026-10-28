import { useSearchParams } from "react-router-dom";
import { Async, Empty, PageHead } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useOnNewActivity } from "../../lib/live";
import RequestItem from "./RequestItem";

export default function Requests() {
  useTitle("Access requests");
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "pending";
  const state = useApi(`/teacher/requests/?status=${status}`);
  useOnNewActivity(state.reload, ["requests"]);
  return (
    <>
      <PageHead title="Access requests"><p className="muted">Approve the students who are in your classes. You can put them in a class at the same time.</p></PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <nav className="chips" aria-label="Filter requests">
              {d.statuses.map((st) => (
                <button key={st.value} type="button" className="chip" aria-current={status === st.value} onClick={() => setParams({ status: st.value })}>
                  {st.label} ({st.count})
                </button>
              ))}
            </nav>
            {d.requests.length ? (
              <ul className="list">{d.requests.map((r) => <RequestItem key={r.id} request={r} classrooms={d.classrooms} onDone={state.reload} />)}</ul>
            ) : status === "pending" ? (
              <Empty title="No one is waiting">When a student requests access, they appear here for you to approve.</Empty>
            ) : <Empty title="Nothing here">No requests have this status.</Empty>}
          </>
        )}
      </Async>
    </>
  );
}

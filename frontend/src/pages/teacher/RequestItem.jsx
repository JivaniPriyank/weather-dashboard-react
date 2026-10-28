import { useState } from "react";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { formatDate } from "../../lib/speech";

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// One access request with class choice and Approve / Decline.
export default function RequestItem({ request: r, classrooms, onDone }) {
  const { levels } = useSession();
  const [level, setLevel] = useState(r.student.level || "");
  const [classroom, setClassroom] = useState(r.student.classroom_id || "");
  const matching = classrooms.filter((c) => c.level && c.level === level);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { refresh } = useSession();
  const chooseLevel = (code) => {
    setLevel(code);
    if (!classrooms.some((c) => String(c.id) === String(classroom) && c.level === code)) setClassroom("");
  };

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await api(`/teacher/requests/${r.id}/decide/`, { method: "POST", body: { decision, level: level || null, classroom: classroom || null } });
      toast(res.message);
      refresh();
      onDone();
    } catch (e) {
      toast(e.message, "error");
      setBusy(false);
    }
  };

  return (
    <li className="request">
      <div>
        <span className="row-title">{r.student.full_name}</span>
        <span className="row-sub">{r.student.email}, asked {timeAgo(r.created_at)}</span>
        <span className="row-sub">{r.student.level ? <>Chose level <b>{r.student.level}</b></> : "No level chosen"}</span>
        {r.note && <p className="note-quote">“{r.note}”</p>}
        {r.status !== "pending" && <p className="row-sub" style={{ margin: "var(--s2) 0 0" }}>{r.status_label}{r.reviewed_at ? ` on ${formatDate(r.reviewed_at)}` : ""}</p>}
      </div>
      <div className="request-actions">
        {r.status !== "approved" && (
          <>
            <label className="visually-hidden" htmlFor={`level-${r.id}`}>Level for {r.student.full_name}</label>
            <select id={`level-${r.id}`} value={level} onChange={(e) => chooseLevel(e.target.value)} className="level-select">
              {!level && <option value="">Level…</option>}
              {levels.map((lv) => <option key={lv.code} value={lv.code}>{lv.code}</option>)}
            </select>
            <label className="visually-hidden" htmlFor={`class-${r.id}`}>Class for {r.student.full_name}</label>
            <select id={`class-${r.id}`} value={classroom} onChange={(e) => setClassroom(e.target.value)} disabled={!level}>
              <option value="">No class</option>
              {matching.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.level})</option>)}
            </select>
            <button className="btn btn-good btn-small" type="button" aria-disabled={busy} onClick={() => decide("approved")}><Icon name="check" />Approve</button>
          </>
        )}
        {r.status !== "rejected" && <button className="btn btn-bad btn-small" type="button" aria-disabled={busy} onClick={() => decide("rejected")}>Decline</button>}
      </div>
    </li>
  );
}

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function Waiting() {
  const { user, refresh } = useSession();
  const [checking, setChecking] = useState(false);
  useTitle(user?.status === "rejected" ? "Not approved" : "Waiting for approval");

  if (!user) return <Navigate to="/sign-in" replace />;
  if (user.status === "approved") return <Navigate to={user.is_teacher ? "/teacher" : "/today"} replace />;

  const check = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {user.status === "rejected" ? (
          <>
            <h1>Your request wasn't approved</h1>
            <p>Your teacher didn't approve the account for {user.email}. If you think this is a mistake, ask them in your next lesson.</p>
          </>
        ) : (
          <>
            <h1>Waiting for your teacher</h1>
            <p>Your request for <b>{user.email}</b> has been sent. Your teacher will approve it soon.</p>
            <p className="muted">Check back later. Once you're approved, this page leads straight to your practice.</p>
            <div className="actions" style={{ marginTop: "var(--s5)" }}>
              <button className="btn btn-primary" type="button" onClick={check} aria-disabled={checking}>{checking ? "Checking…" : "Check again"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

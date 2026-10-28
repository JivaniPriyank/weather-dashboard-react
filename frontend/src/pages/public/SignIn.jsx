import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field, FormError } from "../../components/ui";
import { api } from "../../lib/api";
import { useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

// Only go back to a page on this website: "/words" yes; "//evil.com", "/\evil.com" or "https://…" no.
export function safeNext(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return null;
  return next;
}

export default function SignIn() {
  useTitle("Sign in");
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api("/sign-in/", { method: "POST", body: form });
      setSession(data);
      const next = safeNext(params.get("next"));
      const u = data.user;
      navigate(u.status !== "approved" ? "/waiting" : next || (u.is_teacher ? "/teacher" : "/today"), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="muted">Welcome back. Pick up where you left off.</p>
        <form className="form" onSubmit={submit} noValidate>
          <FormError error={error} />
          <Field label="Email" name="email" type="email" autoComplete="email" autoFocus required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="btn btn-primary btn-block" type="submit" aria-disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <Link className="small" to="/password-reset">Forgot your password?</Link>
        </form>
        <p className="auth-foot">New here? <Link to="/join">Request access</Link> from your teacher.</p>
      </div>
    </div>
  );
}

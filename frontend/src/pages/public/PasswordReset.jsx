import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Field, FormError, Loading } from "../../components/ui";
import { useToast } from "../../components/Toasts";
import { api } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";

export function PasswordReset() {
  useTitle("Reset your password");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api("/password/reset/", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setErrors(err.fieldErrors);
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {sent ? (
          <>
            <h1>Check your email</h1>
            <p>If an account exists for that address, a reset link is on its way.</p>
            <p className="muted small">Email sending isn't switched on yet. Until it is, your teacher can see the link in the server window, or reset your password for you.</p>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            <p className="muted">Enter your email and we'll send you a link to choose a new password.</p>
            <form className="form" onSubmit={submit} noValidate>
              <Field label="Email" name="email" type="email" autoComplete="email" errors={errors} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary btn-block" type="submit" aria-disabled={busy}>Send reset link</button>
            </form>
          </>
        )}
        <p className="auth-foot"><Link to="/sign-in">Back to sign in</Link></p>
      </div>
    </div>
  );
}

export function PasswordResetConfirm() {
  useTitle("Choose a new password");
  const { uid, token } = useParams();
  const check = useApi(`/password/reset/${uid}/${token}/`);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ new_password1: "", new_password2: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(`/password/reset/${uid}/${token}/`, { method: "POST", body: form });
      toast("Password changed. Sign in with your new password.");
      navigate("/sign-in");
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
    }
  };

  if (check.loading) return <div className="auth-wrap"><Loading /></div>;
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {check.data?.valid ? (
          <>
            <h1>Choose a new password</h1>
            <form className="form" onSubmit={submit} noValidate>
              <FormError error={error} />
              <Field label="New password" name="new_password1" type="password" autoComplete="new-password" errors={errors}
                value={form.new_password1} onChange={(e) => setForm({ ...form, new_password1: e.target.value })} />
              <Field label="New password again" name="new_password2" type="password" autoComplete="new-password" errors={errors}
                value={form.new_password2} onChange={(e) => setForm({ ...form, new_password2: e.target.value })} />
              <button className="btn btn-primary btn-block" type="submit">Save new password</button>
            </form>
          </>
        ) : (
          <>
            <h1>This link has expired</h1>
            <p>Reset links work once and only for a few days. Ask for a new one.</p>
            <Link className="btn btn-primary" to="/password-reset">Send a new link</Link>
          </>
        )}
      </div>
    </div>
  );
}

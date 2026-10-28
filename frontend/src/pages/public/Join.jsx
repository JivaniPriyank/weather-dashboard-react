import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, FormError } from "../../components/ui";
import { api } from "../../lib/api";
import { useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function Join() {
  useTitle("Request access");
  const { setSession, levels } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password1: "", password2: "", level: "", note: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      setSession(await api("/register/", { method: "POST", body: form }));
      navigate("/waiting", { replace: true });
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(Object.keys(err.fieldErrors).length ? "Some details need fixing. See the notes below." : err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Request access</h1>
        <p className="muted">Create your account. Your teacher approves it, then you can start practising.</p>
        <form className="form" onSubmit={submit} noValidate>
          <FormError error={error} />
          <Field label="Your name" name="full_name" autoComplete="name" errors={errors} value={form.full_name} onChange={set("full_name")} />
          <Field label="Email" name="email" type="email" autoComplete="email" errors={errors} value={form.email} onChange={set("email")} />
          <Field label="Password" name="password1" type="password" autoComplete="new-password" errors={errors}
            help="At least 8 characters, not only numbers." value={form.password1} onChange={set("password1")} />
          <Field label="Password again" name="password2" type="password" autoComplete="new-password" errors={errors} value={form.password2} onChange={set("password2")} />
          <fieldset className={`field${errors.level ? " has-error" : ""}`}>
            <legend>Your German level</legend>
            <div className="level-pick">
              {levels.map((lv) => (
                <label key={lv.code} className="level-option">
                  <input type="radio" name="level" value={lv.code} checked={form.level === lv.code} onChange={set("level")} />
                  <span><b>{lv.code}</b>{lv.name}</span>
                </label>
              ))}
            </div>
            <p className="help">You'll practise only this level. Your teacher can move you up later.</p>
            {errors.level && <p className="error">{errors.level.join(" ")}</p>}
          </fieldset>
          <Field label="Message to your teacher (optional)" name="note" errors={errors} placeholder="e.g. I'm in the Tuesday A1 class"
            value={form.note} onChange={set("note")} />
          <button className="btn btn-primary btn-block" type="submit" aria-disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
        </form>
        <p className="auth-foot">Already approved? <Link to="/sign-in">Sign in</Link></p>
      </div>
    </div>
  );
}

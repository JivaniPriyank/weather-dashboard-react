import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../../components/Icon";
import { useSignOut } from "../../components/Layout";
import { useToast } from "../../components/Toasts";
import { Field, FormError, PageHead } from "../../components/ui";
import { api } from "../../lib/api";
import { useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export function Account() {
  useTitle("Your account");
  const { user, setSession } = useSession();
  const toast = useToast();
  const signOut = useSignOut();
  const [name, setName] = useState(user.full_name);
  const [errors, setErrors] = useState({});

  const save = async (e) => {
    e.preventDefault();
    try {
      setSession(await api("/me/", { method: "PATCH", body: { full_name: name } }));
      setErrors({});
      toast("Your name is saved.");
    } catch (err) {
      setErrors(err.fieldErrors);
    }
  };

  return (
    <>
      <PageHead title="Your account"><p className="muted">{user.email}{user.classroom ? `, class ${user.classroom.name}` : ""}</p></PageHead>
      <div className="panel">
        <form className="form" onSubmit={save} noValidate>
          <Field label="Your name" name="full_name" errors={errors} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="actions"><button className="btn btn-primary" type="submit">Save name</button></div>
        </form>
      </div>
      <div className="panel">
        <h2>Password</h2>
        <p className="muted">Change the password you sign in with.</p>
        <Link className="btn btn-secondary" to="/account/password">Change password</Link>
      </div>
      <div className="panel">
        <button className="btn btn-secondary" type="button" onClick={signOut}><Icon name="out" />Sign out</button>
      </div>
    </>
  );
}

export function PasswordChange() {
  useTitle("Change password");
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ old_password: "", new_password1: "", new_password2: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api("/password/change/", { method: "POST", body: form });
      toast("Password changed.");
      navigate("/account");
    } catch (err) {
      setErrors(err.fieldErrors);
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead crumb={{ to: "/account", label: "Your account" }} title="Change password" />
      <div className="panel">
        <form className="form" onSubmit={submit} noValidate>
          <FormError error={error} />
          <Field label="Current password" name="old_password" type="password" autoComplete="current-password" errors={errors} value={form.old_password} onChange={set("old_password")} />
          <Field label="New password" name="new_password1" type="password" autoComplete="new-password" errors={errors} value={form.new_password1} onChange={set("new_password1")} />
          <Field label="New password again" name="new_password2" type="password" autoComplete="new-password" errors={errors} value={form.new_password2} onChange={set("new_password2")} />
          <div className="actions"><button className="btn btn-primary" type="submit">Change password</button></div>
        </form>
      </div>
    </>
  );
}

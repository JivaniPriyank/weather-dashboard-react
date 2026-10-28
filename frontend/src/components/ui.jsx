import { useId } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { canSpeak, say } from "../lib/speech";

// A labelled form field with help text and error messages.
export function Field({ label, name, errors, help, as = "input", children, className = "", ...props }) {
  const id = useId();
  const fieldErrors = errors?.[name] || [];
  const describedBy = [help && `${id}-help`, fieldErrors.length && `${id}-err`].filter(Boolean).join(" ") || undefined;
  const control =
    as === "textarea" ? <textarea id={id} name={name} aria-describedby={describedBy} aria-invalid={fieldErrors.length > 0 || undefined} {...props} />
    : as === "select" ? <select id={id} name={name} aria-describedby={describedBy} aria-invalid={fieldErrors.length > 0 || undefined} {...props}>{children}</select>
    : <input id={id} name={name} type="text" aria-describedby={describedBy} aria-invalid={fieldErrors.length > 0 || undefined} {...props} />;
  return (
    <div className={`field${fieldErrors.length ? " has-error" : ""} ${className}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {help && <p className="help" id={`${id}-help`}>{help}</p>}
      {fieldErrors.length > 0 && <p className="error" id={`${id}-err`}>{fieldErrors.join(" ")}</p>}
    </div>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <div className="field">
      <label className="check"><input type="checkbox" {...props} /> {label}</label>
    </div>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return <div className="form-errors" role="alert"><p>{error}</p></div>;
}

export function Loading({ label = "Loading…" }) {
  return <div className="loading" aria-busy="true"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <h2>{error?.status === 404 ? "This page doesn't exist" : "This page couldn't load"}</h2>
      <p>{error?.status === 404 ? "The link may be old or mistyped. Use the menu to find your way back." : error?.message}</p>
      {onRetry && error?.status !== 404 && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// Show loading / error / content for a useApi() result.
export function Async({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  return children(state.data);
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SayButton({ text, label, small }) {
  if (!canSpeak) return null;
  return (
    <button className="say" type="button" style={small ? { width: 28, height: 28 } : undefined}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); say(text); }} aria-label={label || `Listen: ${text}`}>
      <Icon name="say" />
    </button>
  );
}

export function PageHead({ crumb, title, lang, children, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumb && <Link className="crumb" to={crumb.to}>{crumb.label}</Link>}
        <h1 lang={lang}>{title}</h1>
        {children}
      </div>
      {actions}
    </div>
  );
}

export function RowLink({ to, icon, title, sub, end, lang }) {
  return (
    <li>
      <Link className="row" to={to}>
        {icon && <Icon name={icon} />}
        <span className="row-main">
          <span className="row-title" lang={lang}>{title}</span>
          {sub && <span className="row-sub">{sub}</span>}
        </span>
        <span className="row-end">{end}<span className="chev"><Icon name="chevron" /></span></span>
      </Link>
    </li>
  );
}

export function scoreClass(score, total) {
  const pct = total ? (score / total) * 100 : 0;
  return pct >= 70 ? "badge-good" : pct >= 50 ? "badge-note" : "badge-bad";
}

export function Article({ article }) {
  if (!article) return null;
  return <><span className={`art art-${article}`}>{article}</span>{" "}</>;
}

export function Meter({ percent, good, label, style, practised }) {
  if (practised != null) {
    // two layers: words practised (light blue) with words learned for good (green) on top
    return (
      <div className="meter meter-two" role="img" aria-label={label} style={style}>
        <span className="meter-practised" style={{ width: `${practised}%` }} />
        <span className="meter-learned" style={{ width: `${percent}%` }} />
      </div>
    );
  }
  return (
    <div className={`meter${good ? " meter-good" : ""}`} role="img" aria-label={label} style={style}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

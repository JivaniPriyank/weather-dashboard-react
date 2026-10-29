import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon";
import { Async, Empty, PageHead } from "../../../components/ui";
import { useApi, useLevelKey, useTitle } from "../../../lib/hooks";
import { TABS } from "./parts";

const ART_CLASS = { der: "art-der", die: "art-die", das: "art-das" };

export default function ContentHome() {
  useTitle("Content");
  const [params, setParams] = useSearchParams();
  const sessionLevel = useLevelKey();
  const level = params.get("level") || sessionLevel || "A1";
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "words";
  const state = useApi(`/teacher/content/?level=${encodeURIComponent(level)}`);
  const [q, setQ] = useState("");
  const current = TABS.find((t) => t.id === tab);
  const go = (next) => setParams({ level, tab, ...next }, { replace: true });

  return (
    <>
      <PageHead title="Content" actions={
        <Link className="btn btn-primary" to={`${current.to}?level=${level}`}><Icon name="plus" />{current.add}</Link>
      }>
        <p className="muted">Everything your students learn. Changes show up for them straight away.</p>
      </PageHead>

      <Async state={state}>
        {(d) => (
          <>
            <div className="content-toolbar">
              <div className="seg" role="group" aria-label="Level">
                {d.levels.map((lv) => (
                  <button key={lv.code} type="button" aria-pressed={lv.code === d.level.code} onClick={() => go({ level: lv.code })}>
                    {lv.code} <span className="seg-sub">{lv.name}</span>
                  </button>
                ))}
              </div>
              <label className="content-search">
                <span className="visually-hidden">Search this level</span>
                <input type="search" placeholder="Search words, questions, tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </div>

            <div className="content-tabs" role="tablist" aria-label="Kind of content">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} onClick={() => go({ tab: t.id })}>
                  {t.label}<span className="tab-count">{d.counts[t.id]}</span>
                </button>
              ))}
            </div>

            <TabBody tab={tab} data={d} q={q.trim().toLowerCase()} />
          </>
        )}
      </Async>
      <p className="muted small mt-7">
        Need something not on these pages, like adding a new level? Use the <a href="/admin/">advanced editor</a>.
      </p>
    </>
  );
}

// The teacher's own sections, e.g. "Basics of A1".
function SectionCards({ data, q }) {
  const level = data.level.code;
  const shown = data.sections.filter((x) => !q || `${x.title} ${x.description}`.toLowerCase().includes(q));
  return (
    <>
      <p className="muted section-intro">Build your own parts of the course from lessons: text, tables, words, sounds and exercises. Students of {level} find them in their menu.</p>
      <div className="topic-grid">
        {shown.map((x) => (
          <Link key={x.id} className="topic-card section-card" to={`/teacher/content/sections/${x.id}`}>
            <span className="topic-card-head">
              <span className="section-card-icon"><Icon name={x.icon} /></span>
              <span className={`badge ${x.is_visible ? "badge-good" : "badge-note"}`}>{x.is_visible ? "Students can see it" : "Hidden"}</span>
            </span>
            <span>
              <span className="topic-card-name">{x.title}</span>
              <span className="topic-card-desc">{x.description}</span>
            </span>
            <span className="topic-card-words">
              <span>{x.lessons} lesson{x.lessons === 1 ? "" : "s"}{x.lessons !== x.published ? `, ${x.published} published` : ""}</span>
            </span>
            <span className="topic-card-go">Edit lessons<Icon name="chevron" /></span>
          </Link>
        ))}
        {!q && (
          <Link className="topic-new" to={`/teacher/content/sections/new?level=${level}`}>
            <Icon name="plus" />New section
          </Link>
        )}
        {q && !shown.length && <Empty title="Nothing found">No section at {level} matches “{q}”.</Empty>}
      </div>
    </>
  );
}

function TabBody({ tab, data, q }) {
  const level = data.level.code;
  const has = (...texts) => !q || texts.some((t) => (t || "").toLowerCase().includes(q));

  const topics = useMemo(() => data.topics.filter((t) => has(t.name, t.description, ...t.preview.map((w) => w.german))), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tab === "sections") return <SectionCards data={data} q={q} />;

  if (tab === "words") {
    return (
      <div className="topic-grid">
        {topics.map((t) => (
          <Link key={t.id} className="topic-card" to={`/teacher/content/topics/${t.id}`}>
            <span className="topic-card-head">
              <span>
                <span className="topic-card-name" lang="de">{t.name}</span>
                <span className="topic-card-desc">{t.description}</span>
              </span>
              <span className="badge badge-royal">{t.count} {t.count === 1 ? "word" : "words"}</span>
            </span>
            <span className="topic-card-words" lang="de">
              {t.preview.length ? t.preview.map((w, i) => (
                <span key={i}>{w.article && <b className={ART_CLASS[w.article]}>{w.article} </b>}{w.german}</span>
              )) : <span className="muted">No words yet</span>}
            </span>
            <span className="topic-card-go">Edit words<Icon name="chevron" /></span>
          </Link>
        ))}
        {!q && (
          <Link className="topic-new" to={`/teacher/content/topics/new?level=${level}`}>
            <Icon name="plus" />New topic
          </Link>
        )}
        {q && !topics.length && <Empty title="Nothing found">No word topic at {level} matches “{q}”.</Empty>}
      </div>
    );
  }

  let rows = [];
  if (tab === "quiz") rows = data.questions.filter((x) => has(x.prompt, x.grammar_topic)).map((x) => ({
    id: x.id, to: `/teacher/content/questions/${x.id}`, title: x.prompt, lang: "de",
    sub: x.grammar_topic ? `Grammar: ${x.grammar_topic}` : "Not linked to a grammar topic",
    badge: x.kind === "choice" ? "Multiple choice" : "Type the answer", badgeClass: x.kind === "choice" ? "badge-royal" : "badge-note",
  }));
  if (tab === "grammar") rows = data.grammar.filter((x) => has(x.title)).map((x) => ({
    id: x.id, to: `/teacher/content/grammar/${x.id}`, title: x.title,
    sub: [`${x.questions} quiz question${x.questions === 1 ? "" : "s"}`, x.has_table ? "table" : "no table", `${x.examples} example${x.examples === 1 ? "" : "s"}`].join(" · "),
    badge: "Grammar", badgeClass: "badge-good",
  }));
  if (tab === "speaking") rows = data.speaking.filter((x) => has(x.title, x.part_label)).map((x) => ({
    id: x.id, to: `/teacher/content/speaking/${x.id}`, title: x.title, lang: "de",
    sub: `${x.minutes} min · ${x.lines} questions and phrases`, badge: x.part_label, badgeClass: "badge-royal",
  }));

  if (!rows.length) {
    const t = TABS.find((x) => x.id === tab);
    return q
      ? <Empty title="Nothing found">Nothing at {level} matches “{q}”.</Empty>
      : <Empty title={`No ${t.label.toLowerCase()} at ${level} yet`} action={<Link className="btn btn-primary" to={`${t.to}?level=${level}`}>{t.add}</Link>} />;
  }
  return (
    <ul className="list content-list">
      {rows.map((r) => (
        <li key={r.id}>
          <Link className="row" to={r.to}>
            <span className={`badge ${r.badgeClass} content-badge`}>{r.badge}</span>
            <span className="row-main">
              <span className="row-title" lang={r.lang}>{r.title}</span>
              <span className="row-sub">{r.sub}</span>
            </span>
            <span className="row-end"><span className="chev"><Icon name="chevron" /></span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { useParams } from "react-router-dom";
import { Async, PageHead, RowLink, SayButton } from "../../components/ui";
import { useApi, useTitle } from "../../lib/hooks";
import { useStartQuiz } from "./Practice";

export default function GrammarTopic() {
  const { level, slug } = useParams();
  const state = useApi(`/grammar/${level}/${slug}/`);
  useTitle(state.data?.topic.title);
  const [start, busy] = useStartQuiz();
  return (
    <Async state={state}>
      {({ topic, videos }) => (
        <>
          <PageHead crumb={{ to: "/grammar", label: "Grammar" }} title={topic.title} lang="de"
            actions={topic.questions > 0 && (
              <button className="btn btn-primary" type="button" aria-disabled={busy} onClick={() => start(topic.level, topic.id)}>
                Practise this ({topic.questions} questions)
              </button>
            )}>
            <p className="muted">{topic.level} grammar</p>
          </PageHead>

          <p className="rule">{topic.rule}</p>

          {topic.table?.headers && (
            <div className="table-wrap" style={{ margin: "var(--s5) 0" }}>
              <table className="grammar-table" lang="de">
                <thead><tr>{topic.table.headers.map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead>
                <tbody>{topic.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}

          {topic.examples.length > 0 && (
            <section className="section">
              <h2>Examples</h2>
              <div className="examples">
                {topic.examples.map((e) => (
                  <div className="example" key={e.german}>
                    <div><div className="de-line" lang="de">{e.german}</div><div className="en-line">{e.english}</div></div>
                    <SayButton text={e.german} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section className="section">
              <h2>Videos on this topic</h2>
              <ul className="list">{videos.map((v) => <RowLink key={v.id} to={`/videos/${v.id}`} icon="videos" title={v.title} />)}</ul>
            </section>
          )}
        </>
      )}
    </Async>
  );
}

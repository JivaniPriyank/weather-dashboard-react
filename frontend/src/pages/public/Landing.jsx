import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { useApi, useTitle } from "../../lib/hooks";

export default function Landing() {
  useTitle("German practice for A1 and A2");
  const { data } = useApi("/landing/");
  return (
    <>
      <section className="hero">
        <div>
          <h1>Practise German between lessons.</h1>
          <p className="lead">Your teacher's words, quizzes, speaking tasks, grammar notes and videos, in one place. Built for A1 and A2 and the Goethe speaking exam.</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/join">Request access</Link>
            <Link className="btn btn-secondary" to="/sign-in">I already have an account</Link>
          </div>
        </div>
        <div className="hero-board paper" aria-label="Example words">
          <span className="margin-line" aria-hidden="true" />
          <ul className="hero-words">
            <li><span className="de"><span className="art-der">der</span> Vater</span><span className="en">the father</span></li>
            <li><span className="de"><span className="art-die">die</span> Küche</span><span className="en">the kitchen</span></li>
            <li><span className="de"><span className="art-das">das</span> Brot</span><span className="en">the bread</span></li>
            <li><span className="de">obwohl</span><span className="en">although</span></li>
            <li><span className="de">Ich hätte gern …</span><span className="en">I would like …</span></li>
          </ul>
        </div>
      </section>

      <section className="features" aria-label="What you can practise">
        <div className="feature"><Icon name="words" /><h2>Words that come back</h2><p>{data?.words ?? "Your"} words in topic decks. The ones you miss return sooner, the ones you know wait longer.</p></div>
        <div className="feature"><Icon name="practice" /><h2>Quizzes with reasons</h2><p>{data?.questions ?? "Many"} questions by grammar topic. Every answer explains why, and you see your mistakes at the end.</p></div>
        <div className="feature"><Icon name="speaking" /><h2>Speaking exam tasks</h2><p>{data?.speaking ?? "Several"} tasks in the Goethe format. Record your answer and get points and feedback from your teacher.</p></div>
        <div className="feature"><Icon name="videos" /><h2>Your teacher's videos</h2><p>Lessons recorded for your class, next to the grammar they explain.</p></div>
      </section>

      <section className="how">
        <h2>How to join</h2>
        <ol>
          <li><b>Request access</b><span>Create an account with your name and email.</span></li>
          <li><b>Your teacher approves you</b><span>They check that you're in their class.</span></li>
          <li><b>Start practising</b><span>Sign in on your phone or computer, wherever you are.</span></li>
        </ol>
      </section>
    </>
  );
}

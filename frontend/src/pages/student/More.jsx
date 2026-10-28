import Icon from "../../components/Icon";
import { useSignOut } from "../../components/Layout";
import { PageHead, RowLink } from "../../components/ui";
import { useTitle } from "../../lib/hooks";
import { useSession } from "../../lib/session";

export default function More() {
  useTitle("More");
  const { user } = useSession();
  const signOut = useSignOut();
  return (
    <>
      <PageHead title="More" />
      <ul className="list">
        {user.is_teacher && (
          <>
            <RowLink to="/teacher/videos" icon="upload" title="My videos" />
            <RowLink to="/teacher/classes" icon="classes" title="Classes" />
            <RowLink to="/teacher/content" icon="edit" title="Content" sub="Words, quiz questions, grammar, speaking tasks" />
            <RowLink to="/words" icon="words" title="Words" sub="See the student pages" />
            <RowLink to="/practice" icon="practice" title="Practice" />
            <RowLink to="/speaking" icon="speaking" title="Speaking" />
          </>
        )}
        <RowLink to="/grammar" icon="grammar" title="Grammar" />
        <RowLink to="/videos" icon="videos" title="Videos" />
        {!user.is_teacher && <RowLink to="/progress" icon="progress" title="Progress" />}
        <RowLink to="/account" icon="account" title="Your account" sub={user.email} />
      </ul>
      <button className="btn btn-secondary btn-block" style={{ marginTop: "var(--s5)" }} type="button" onClick={signOut}><Icon name="out" />Sign out</button>
    </>
  );
}

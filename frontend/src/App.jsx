import { Link, Route, Routes } from "react-router-dom";
import { AppLayout, GuestOnly, PublicLayout, RequireApproved, RequireTeacher } from "./components/Layout";

import Landing from "./pages/public/Landing";
import SignIn from "./pages/public/SignIn";
import Join from "./pages/public/Join";
import Waiting from "./pages/public/Waiting";
import { PasswordReset, PasswordResetConfirm } from "./pages/public/PasswordReset";

import Today from "./pages/student/Today";
import Progress from "./pages/student/Progress";
import More from "./pages/student/More";
import { Account, PasswordChange } from "./pages/student/Account";
import Decks from "./pages/student/Decks";
import Deck from "./pages/student/Deck";
import Study from "./pages/student/Study";
import Practice from "./pages/student/Practice";
import Attempt from "./pages/student/Attempt";
import Results from "./pages/student/Results";
import Speaking from "./pages/student/Speaking";
import SpeakingTask from "./pages/student/SpeakingTask";
import Grammar from "./pages/student/Grammar";
import GrammarTopic from "./pages/student/GrammarTopic";
import Videos from "./pages/student/Videos";
import VideoDetail from "./pages/student/VideoDetail";

import Overview from "./pages/teacher/Overview";
import Requests from "./pages/teacher/Requests";
import Students from "./pages/teacher/Students";
import StudentDetail from "./pages/teacher/StudentDetail";
import { ClassEdit, Classes } from "./pages/teacher/Classes";
import { TeacherVideos, VideoEdit } from "./pages/teacher/Videos";
import { SpeakingInbox, SpeakingReview } from "./pages/teacher/SpeakingAnswers";
import ContentHome from "./pages/teacher/content/ContentHome";
import { TopicEdit, TopicNew } from "./pages/teacher/content/TopicEdit";
import QuestionEdit from "./pages/teacher/content/QuestionEdit";
import GrammarEdit from "./pages/teacher/content/GrammarEdit";
import SpeakingEdit from "./pages/teacher/content/SpeakingEdit";

function NotFound() {
  return (
    <div className="error-page">
      <div className="code" aria-hidden="true">404</div>
      <h1>This page doesn't exist</h1>
      <p className="lead" style={{ margin: "12px auto 24px" }}>The link may be old or mistyped.</p>
      <Link className="btn btn-primary" to="/">Go to the start page</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route element={<GuestOnly />}>
          <Route index element={<Landing />} />
          <Route path="sign-in" element={<SignIn />} />
          <Route path="join" element={<Join />} />
        </Route>
        <Route path="waiting" element={<Waiting />} />
        <Route path="password-reset" element={<PasswordReset />} />
        <Route path="password-reset/:uid/:token" element={<PasswordResetConfirm />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireApproved />}>
        <Route element={<AppLayout />}>
          <Route path="today" element={<Today />} />
          <Route path="progress" element={<Progress />} />
          <Route path="more" element={<More />} />
          <Route path="account" element={<Account />} />
          <Route path="account/password" element={<PasswordChange />} />
          <Route path="words" element={<Decks />} />
          <Route path="words/:level/:slug" element={<Deck />} />
          <Route path="words/:level/:slug/study" element={<Study />} />
          <Route path="practice" element={<Practice />} />
          <Route path="practice/:id" element={<Attempt />} />
          <Route path="practice/:id/results" element={<Results />} />
          <Route path="speaking" element={<Speaking />} />
          <Route path="speaking/:level/:slug" element={<SpeakingTask />} />
          <Route path="grammar" element={<Grammar />} />
          <Route path="grammar/:level/:slug" element={<GrammarTopic />} />
          <Route path="videos" element={<Videos />} />
          <Route path="videos/:id" element={<VideoDetail />} />

          <Route path="teacher" element={<RequireTeacher />}>
            <Route index element={<Overview />} />
            <Route path="requests" element={<Requests />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="classes" element={<Classes />} />
            <Route path="classes/:id" element={<ClassEdit />} />
            <Route path="videos" element={<TeacherVideos />} />
            <Route path="videos/new" element={<VideoEdit />} />
            <Route path="videos/:id" element={<VideoEdit />} />
            <Route path="speaking" element={<SpeakingInbox />} />
            <Route path="speaking/:id" element={<SpeakingReview />} />
            <Route path="content" element={<ContentHome />} />
            <Route path="content/topics/new" element={<TopicNew />} />
            <Route path="content/topics/:id" element={<TopicEdit />} />
            <Route path="content/questions/new" element={<QuestionEdit />} />
            <Route path="content/questions/:id" element={<QuestionEdit />} />
            <Route path="content/grammar/new" element={<GrammarEdit />} />
            <Route path="content/grammar/:id" element={<GrammarEdit />} />
            <Route path="content/speaking/new" element={<SpeakingEdit />} />
            <Route path="content/speaking/:id" element={<SpeakingEdit />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

// Live updates for the teacher: no reload needed to see new access requests or
// speaking answers. The page asks the server every 30 seconds (only while the tab
// is visible) and right away when you come back to the tab.
import { useEffect, useRef } from "react";
import { api } from "./api";
import { useSession } from "./session";
import { useToast } from "../components/Toasts";
import { plural } from "./speech";

const EVERY_MS = 30_000;
const EVENT = "gl:new-activity";

// Use once, in the app layout, for teachers.
export function useTeacherLiveUpdates(enabled) {
  const { counts, setSession } = useSession();
  const toast = useToast();
  const last = useRef(counts);
  last.current = counts; // changes you make yourself (e.g. approving) never count as "new"

  useEffect(() => {
    if (!enabled) return undefined;
    let busy = false;

    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const data = await api("/session/");
        const before = last.current || {};
        const now = data.counts || {};
        if (!data.user || !data.user.is_teacher) {
          setSession(data); // signed out meanwhile: the app shows the sign-in page
          return;
        }
        const newRequests = (now.pending_requests || 0) - (before.pending_requests || 0);
        const newAnswers = (now.speaking_waiting || 0) - (before.speaking_waiting || 0);
        if (newRequests > 0) toast(`${plural(newRequests, "new access request")} waiting for you.`);
        if (newAnswers > 0) toast(`${plural(newAnswers, "new speaking answer")} to listen to.`);
        if (newRequests !== 0 || newAnswers !== 0) {
          setSession(data);
          window.dispatchEvent(new CustomEvent(EVENT, {
            detail: { requests: newRequests !== 0, speaking: newAnswers !== 0 },
          }));
        }
      } catch {
        // offline or server restarting: try again next time
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(check, EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, setSession, toast]);
}

// Reload a page's data when something new arrives.
// kinds: which news matters to this page, e.g. ["requests"] or ["requests", "speaking"].
export function useOnNewActivity(reload, kinds) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const key = kinds.join(",");
  useEffect(() => {
    const wanted = key.split(",");
    const handler = (e) => { if (wanted.some((k) => e.detail?.[k])) reloadRef.current(); };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [key]);
}

// Keep a page's data fresh while you look at it: reload every 30 seconds while the
// tab is visible, and right away when you come back to the tab.
export function useReloadWhileOpen(reload) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    const run = () => { if (document.visibilityState === "visible") reloadRef.current(); };
    const timer = setInterval(run, EVERY_MS);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, []);
}

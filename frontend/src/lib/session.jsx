import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const SessionContext = createContext(null);

// Who is signed in, which levels exist, and the teacher's waiting counters.
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api("/session/");
      setSession(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error && !session) {
    return (
      <div className="error-page">
        <h1>The German Lab can't load</h1>
        <p className="lead" style={{ margin: "12px auto 24px" }}>{error.message}</p>
        <button className="btn btn-primary" onClick={refresh}>Try again</button>
      </div>
    );
  }
  if (!session) return <div className="splash" aria-busy="true">Loading…</div>;

  return <SessionContext.Provider value={{ ...session, setSession, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

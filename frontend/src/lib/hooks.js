import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useSession } from "./session";

// Load data from the API: { data, error, loading, reload, setData }.
// Pass `null` as the path to skip loading.
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const { refresh } = useSession();
  const counter = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++counter.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (id === counter.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id !== counter.current) return;
      setState({ data: null, error, loading: false });
      // Signed out or approval removed in the meantime: update who we are.
      if (error.status === 401 || error.data?.code === "not_approved") refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = (updater) =>
    setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater }));
  return { ...state, reload: load, setData };
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} – The German Lab` : "The German Lab";
  }, [title]);
}

export function useLevelKey() {
  const { current_level } = useSession();
  return current_level?.code || "";
}

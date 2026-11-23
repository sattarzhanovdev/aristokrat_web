import { useCallback, useEffect, useRef, useState } from "react";
import { getPage } from "../../api/billing";

/** Список с фильтрами, дебаунсом поиска и «Показать ещё». */
export function usePaged(fetcher, params, deps = []) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const req = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError("");
    try {
      const d = await fetcher(JSON.parse(key));
      if (id !== req.current) return;
      setItems(d.results || []);
      setCount(d.count || 0);
      setNext(d.next || null);
    } catch (e) {
      if (id === req.current) setError(e.message);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [fetcher, key]);

  useEffect(() => {
    load();
  }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const d = await getPage(next);
      setItems((x) => [...x, ...(d.results || [])]);
      setNext(d.next || null);
    } finally {
      setMore(false);
    }
  };

  return { items, count, next, loading, more, error, reload: load, loadMore };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

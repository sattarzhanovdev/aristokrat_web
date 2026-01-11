import api from "./http";

export default async function fetchJson(url, options = {}) {
  const method = options.method || "GET";
  const data = options.body;

  const res = await api({
    url,
    method,
    data,
  });

  return res.data;
}

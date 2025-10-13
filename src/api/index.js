export const API_BASE = 'https://aristokratamanat.pythonanywhere.com';

async function parseJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; }
  catch { throw new Error(`Ожидался JSON, статус ${res.status}: ${text.slice(0,160)}`); }
}

export async function fetchJson(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const access = localStorage.getItem('accessToken');

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });

  if (res.status === 401) {
    // авто-рефреш и повтор
    const rf = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!rf.ok) throw new Error('Авторизация истекла');
    const { accessToken, refreshToken } = await rf.json();
    if (accessToken) localStorage.setItem('accessToken', accessToken);

    const retry = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${refreshToken}`,
        ...(opts.headers || {}),
      },
      ...opts,
    });
    const data = await parseJson(retry);
    if (!retry.ok) throw new Error(data?.message || `HTTP ${retry.status}`);
    return data;
  }

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

export async function postBoolean(path, state) {
  return fetchJson(path, {
    method: 'POST',
    body: JSON.stringify({ state: !!state }),
  });
}

// Профиль: получить/сохранить номер подъезда жильца
export async function getResidentEntranceNo() {
  const prof = await fetchJson('/api/profile/me');
  return prof?.entrance_no ?? null;
}
export async function saveResidentEntranceNo(no) {
  const prof = await fetchJson('/api/profile/me', {
    method: 'PATCH',
    body: JSON.stringify({ entrance_no: Number(no) }),
  });
  return prof?.entrance_no ?? null;
}

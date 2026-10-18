let csrfToken = null;

export function setCsrfToken(value) {
  csrfToken = value;
}

export async function api(path, options = {}) {
  const method = options.method ?? "GET";
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(method === "GET" ? {} : { "X-CSRF-Token": csrfToken ?? "" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message ?? `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

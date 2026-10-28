// Talks to the Django API. Uses the browser's session cookie, plus the CSRF token
// Django needs on every change (POST, PATCH, DELETE).

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
  get fieldErrors() {
    return this.data.errors || {};
  }
}

export function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const NETWORK_ERROR = "Couldn't reach the website. Check your internet connection and try again.";

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = { Accept: "application/json" };
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (method !== "GET") headers["X-CSRFToken"] = csrfToken();
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    let message = data?.error;
    if (!message && res.status === 403) message = "Your session has ended. Reload the page and sign in again.";
    throw new ApiError(message || "Something went wrong. Try again in a moment.", res.status, data);
  }
  return data;
}

// Upload with a progress callback (fetch can't report upload progress).
export function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.setRequestHeader("X-CSRFToken", csrfToken());
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data?.error || "The upload didn't work. Try again.", xhr.status, data));
    };
    xhr.onerror = () => reject(new ApiError(NETWORK_ERROR, 0));
    xhr.send(form);
  });
}

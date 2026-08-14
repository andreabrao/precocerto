const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function publicUrl(path = "") {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}

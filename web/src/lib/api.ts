const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("helscoop_token", t);
  else localStorage.removeItem("helscoop_token");
}

export function getToken(): string | null {
  if (token) return token;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("helscoop_token");
  }
  return token;
}

export class ApiError extends Error {
  status: number;
  statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

const ERROR_MESSAGES: Record<number, string> = {
  400: "Virheellinen pyynto / Bad request",
  401: "Istunto vanhentunut / Session expired",
  403: "Ei kayttooikeutta / Access denied",
  404: "Ei loytynyt / Not found",
  409: "Ristiriita / Conflict",
  422: "Virheelliset tiedot / Validation failed",
  429: "Liian monta pyyntoa / Too many requests",
  500: "Palvelinvirhe / Server error",
};

async function apiFetch(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string>),
  };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

  if (!res.ok) {
    const isAuthEndpoint = path.startsWith("/auth/login") || path.startsWith("/auth/register");
    if (res.status === 401 && !isAuthEndpoint) {
      setToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
      throw new ApiError(ERROR_MESSAGES[401], 401, res.statusText);
    }

    const body = await res.json().catch(() => ({ error: res.statusText }));
    const serverMsg = body.error || body.message;
    const fallback = ERROR_MESSAGES[res.status] || `Virhe ${res.status} / Error ${res.status}`;
    throw new ApiError(serverMsg || fallback, res.status, res.statusText);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => apiFetch("/auth/me"),
  updateProfile: (data: { name?: string; email?: string }) =>
    apiFetch("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: () =>
    apiFetch("/auth/account", { method: "DELETE" }),
  exportData: () =>
    apiFetch("/auth/export-data"),
  forgotPassword: (email: string) =>
    apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  verifyEmail: (token: string) =>
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: () =>
    apiFetch("/auth/resend-verification", { method: "POST" }),

  getProjects: () => apiFetch("/projects"),
  getProject: (id: string) => apiFetch(`/projects/${id}`),
  createProject: (data: { name: string; description?: string; scene_js?: string }) =>
    apiFetch("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    apiFetch(`/projects/${id}`, { method: "DELETE" }),
  getTrashProjects: () => apiFetch("/projects/trash"),
  restoreProject: (id: string) =>
    apiFetch(`/projects/${id}/restore`, { method: "POST" }),
  permanentDeleteProject: (id: string) =>
    apiFetch(`/projects/${id}/permanent`, { method: "DELETE" }),
  duplicateProject: (id: string) =>
    apiFetch(`/projects/${id}/duplicate`, { method: "POST" }),
  saveThumbnail: (id: string, thumbnail: string) =>
    apiFetch(`/projects/${id}/thumbnail`, {
      method: "PUT",
      body: JSON.stringify({ thumbnail }),
    }),

  getMaterials: () => apiFetch("/materials"),
  getMaterial: (id: string) => apiFetch(`/materials/${id}`),
  getMaterialPrices: (id: string) => apiFetch(`/materials/${id}/prices`),

  getSuppliers: () => apiFetch("/suppliers"),
  getSupplier: (id: string) => apiFetch(`/suppliers/${id}`),

  comparePrices: (materialId: string) =>
    apiFetch(`/pricing/compare/${materialId}`),
  getPriceHistory: (materialId: string) =>
    apiFetch(`/pricing/history/${materialId}`),
  getStalePrices: () => apiFetch("/pricing/stale"),

  getCategories: () => apiFetch("/categories"),
  getTemplates: () => apiFetch("/templates"),
  exportBOM: (projectId: string) => apiFetch(`/bom/export/${projectId}`),
  exportBOMCsv: async (projectId: string, projectName: string) => {
    const t = getToken();
    const res = await fetch(`${API_URL}/bom/export/${projectId}?format=csv`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      throw new ApiError(
        ERROR_MESSAGES[res.status] || `Virhe ${res.status} / Error ${res.status}`,
        res.status,
        res.statusText
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helscoop_${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportPdf: async (projectId: string, projectName: string, lang: string) => {
    const t = getToken();
    const res = await fetch(`${API_URL}/projects/${projectId}/pdf?lang=${lang}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      throw new ApiError(
        ERROR_MESSAGES[res.status] || `Virhe ${res.status} / Error ${res.status}`,
        res.status,
        res.statusText
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helscoop_${projectName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  saveBOM: (projectId: string, items: { material_id: string; quantity: number; unit: string }[]) =>
    apiFetch(`/projects/${projectId}/bom`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  shareProject: (projectId: string) =>
    apiFetch(`/projects/${projectId}/share`, { method: "POST" }),
  unshareProject: (projectId: string) =>
    apiFetch(`/projects/${projectId}/share`, { method: "DELETE" }),
  getSharedProject: (token: string) =>
    apiFetch(`/shared/${token}`),

  chat: (
    messages: { role: string; content: string }[],
    currentScene: string,
    context?: {
      bomSummary?: { material: string; qty: number; unit: string; total: number }[];
      buildingInfo?: { address?: string; type?: string; year_built?: number; area_m2?: number; floors?: number; material?: string; heating?: string };
      projectInfo?: { name?: string; description?: string };
    },
  ) =>
    apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({
        messages,
        currentScene,
        bomSummary: context?.bomSummary,
        buildingInfo: context?.buildingInfo,
        projectInfo: context?.projectInfo,
      }),
    }),

  getBuilding: (address: string) =>
    apiFetch(`/building?address=${encodeURIComponent(address)}`),
};

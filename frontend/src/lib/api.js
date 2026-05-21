// Ganti dengan URL backend Vercel Anda setelah deploy
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Terjadi kesalahan.");
  }

  return data;
}

// ── AUTH ──────────────────────────────────────────────
export async function login(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function register(email, password, name) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!getToken();
}

// ── GOALS ─────────────────────────────────────────────
export async function getGoals() {
  return request("/api/goals");
}

export async function getGoal(id) {
  return request(`/api/goals/${id}`);
}

export async function createGoal(data) {
  return request("/api/goals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGoal(id, data) {
  return request(`/api/goals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteGoal(id) {
  return request(`/api/goals/${id}`, { method: "DELETE" });
}

// ── MILESTONES ────────────────────────────────────────
export async function toggleMilestone(id, is_done) {
  return request(`/api/milestones/${id}/done`, {
    method: "PATCH",
    body: JSON.stringify({ is_done }),
  });
}

export async function addMilestone(goal_id, title, assignee_name, assignee_email) {
  return request("/api/milestones", {
    method: "POST",
    body: JSON.stringify({ goal_id, title, assignee_name, assignee_email }),
  });
}

export async function deleteMilestone(id) {
  return request(`/api/milestones/${id}`, { method: "DELETE" });
}

// ── EXPORT ────────────────────────────────────────────
export async function exportReport(format = "pdf") {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/export?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-goals.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TEAM ──────────────────────────────────────────────
export async function getTeam() {
  return request("/api/team");
}

export async function addTeamMember(data) {
  return request("/api/team", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTeamMember(id) {
  return request(`/api/team/${id}`, { method: "DELETE" });
}

export async function addGoalMember(goalId, data) {
  return request(`/api/goals/${goalId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteGoalMember(goalId, memberId) {
  return request(`/api/goals/${goalId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// ── ACTIVITIES ────────────────────────────────────────
export async function getActivities() {
  return request("/api/activities");
}

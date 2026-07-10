const API_BASE = '/api/flask/api';

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export function getTreelineOverview() {
  return requestJson('/treeline/overview');
}

export function importTreelineCsv() {
  return requestJson('/treeline/import', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getTreelineRecords({ page = 1, limit = 10, search = '', category = 'all', strata = 'all', hardiness = 'all' } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    category,
    strata,
    hardiness, // Now JavaScript knows what this is!
  });

  return requestJson(`/treeline/records?${query.toString()}`);
}

export async function getShrubStrataCrops(limit = 6) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 100));
  const payload = await getTreelineRecords({
    page: 1,
    limit: safeLimit,
    category: 'Shrub',
    strata: 'Shrub layer',
  });

  return (payload?.records || []).slice(0, safeLimit);
}

export async function getFieldHardiness(polygon) {
  return requestJson('/hardiness/field', {
    method: 'POST',
    body: JSON.stringify({ polygon }),
  });
}

export function getFarms() {
  return requestJson('/farms');
}

export function createFarm(farm) {
  return requestJson('/farms', {
    method: 'POST',
    body: JSON.stringify(farm),
  });
}

export function updateFarmById(farmId, farm) {
  return requestJson(`/farms/${farmId}`, {
    method: 'PUT',
    body: JSON.stringify(farm),
  });
}

export function deleteFarmById(farmId) {
  return requestJson(`/farms/${farmId}`, {
    method: 'DELETE',
  });
}
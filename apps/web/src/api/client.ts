export interface ApiResp<T> {
  code: number;
  msg: string;
  data: T;
  timestamp: number;
  sign: string;
}

const TOKEN_KEY = 'fate_token';

/** 登录态变化事件：登录成功或 token 失效（401）时触发，供全局 UI（如顶部用户信息）同步刷新 */
export const AUTH_CHANGED_EVENT = 'fate:auth-changed';

/** 请求超时（毫秒），防止网络挂起导致界面无限 loading */
const REQUEST_TIMEOUT = 15000;

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResp<T>> {
  const token = getToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  let res: Response;
  try {
    res = await fetch(path, {
      method: options?.method,
      body: options?.body,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
      signal: ctrl.signal,
    });
  } catch {
    throw new Error('网络请求超时或失败，请稍后重试');
  } finally {
    clearTimeout(timer);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`服务响应异常（HTTP ${res.status}）`);
  }
  const body = (await res.json().catch(() => null)) as ApiResp<T> | null;
  if (!body || typeof body !== 'object' || !('code' in body)) {
    throw new Error(`服务响应格式异常（HTTP ${res.status}）`);
  }
  if (body.code === 401) {
    clearToken();
    throw new Error('登录已过期，请重新登录');
  }
  return body;
}

export interface City {
  name: string;
  province: string;
  longitude: number;
  latitude: number;
  timezoneOffset: number;
}

export interface User {
  id: number;
  phone_masked: string | null;
  nickname: string;
  register_channel: string;
  member_level: number;
}

export interface Archive {
  id: number;
  gender: string | null;
  solar_date: string;
  solar_time: string | null;
  city_name: string | null;
  province: string | null;
  longitude: number | null;
  latitude: number | null;
  timezone_offset: number | null;
  time_source: string | null;
  time_precision?: string;
  source_reliability?: string;
  created_at: string;
}

export interface L1Result {
  normalized: { solarDate: string; solarTime: string; timeKnown: boolean; timePrecision: string };
  location: {
    cityName: string;
    province: string;
    longitude: number;
    latitude: number;
    timezoneOffset: number;
    resolvedFromCity: boolean;
  } | null;
  timeCorrection: {
    meanSolarHours: number;
    equationOfTimeMinutes: number;
    trueSolarHours: number;
    offsetMinutes: number;
    totalOffsetMinutes?: number;
    crossDay: boolean;
  };
  shichen: { name: string; branch: string };
  lunar: {
    lunarDate: string;
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    timeGanZhi: string;
    yearAnimal: string;
    currentJieQi: string;
    prevJieQi: { name: string; time: string } | null;
    nextJieQi: { name: string; time: string } | null;
    jieQiNote: string;
  };
  boundaryRisk: boolean;
  dstAdjustment: {
    applied: boolean;
    original: string;
    adjusted: string;
    note: string;
  };
  rating: { grade: string; confidence: number; message: string; suggest: string[] };
}

export interface L2Result {
  schools: Array<{
    school: string;
    version: string;
    note: string;
    data: Record<string, unknown>;
  }>;
  conflicts: string[];
  schoolNote: string;
  dayPrecisionOnly: boolean;
  bazi: {
    gender: string;
    dayMaster: { gan: string; wuxing: string };
    strength: string;
    wuxingCount: Record<string, number>;
    shishenStats: Array<{ name: string; count: number }>;
    xunKong: { xun: string; kong: string };
    taiYuan: string;
    mingGong: string;
    daYun: Array<{
      index: number;
      ganzhi: string;
      startAge: number;
      endAge: number;
      startYear: number;
      endYear: number;
    }>;
    currentDaYun: {
      index: number;
      ganzhi: string;
      startAge: number;
      endAge: number;
      startYear: number;
      endYear: number;
    } | null;
    sectNote?: string;
  };
}

export interface L3Result {
  disenchantNote: string;
  personality: Array<{ dimension: string; score: number; desc: string }>;
  strengths: string[];
  growth: string[];
  behaviorLogic: string;
}

export interface L4Result {
  weightModel: { xiantian: number; liunian: number; renwei: number; note: string };
  dimensions: Array<{
    key: string;
    name: string;
    xiantian: number;
    liunian: number;
    renwei: number;
    total: number;
    advice: string;
  }>;
  summary: string;
}

export interface L5Result {
  karmaPatterns: Array<{ name: string; cause: string; manifestation: string; root: string }>;
  mainKnot: string;
  resolutionPath: string[];
  note: string;
}

export interface L7Result {
  metaRules: string[];
  conflictResolution: Array<{ conflict: string; ruling: string; basis: string }>;
  synthesis: string[];
  coreNote: string;
}

export interface L8Result {
  levels: Array<{
    level: number;
    name: string;
    items: Array<{ title: string; content: string; execCycle: string }>;
  }>;
  note: string;
}

export interface L6Result {
  lines: Array<{ key: string; name: string; strategy: string; fit: number; trigger: string; risk: string }>;
  branchPoints: Array<{
    age: number;
    year: number;
    context: string;
    decisionA: string;
    pathA: string;
    decisionB: string;
    pathB: string;
  }>;
  depthWindows?: Array<{ line: string; windows: string[] }>;
  note: string;
}

export interface L9Result {
  lifeLessons: Array<{ title: string; content: string }>;
  essence: string;
  mantra: string;
  finalNote: string;
}

export interface ReportData {
  l1: L1Result | null;
  l2: L2Result | null;
  l3: L3Result | null;
  l4: L4Result | null;
  l5: L5Result | null;
  l6: L6Result | null;
  l7: L7Result | null;
  l8: L8Result | null;
  l9: L9Result | null;
}

export interface ReportItem {
  layer: number;
  name: string;
  version: string;
  status: 'ready' | 'pending' | 'locked';
  paid: boolean;
  data: unknown;
  note: string | null;
}

export function guestLogin(nickname?: string): Promise<ApiResp<{ user: User; token: string }>> {
  return request('/api/v1/auth/guest', { method: 'POST', body: JSON.stringify({ nickname }) });
}

export function sendSmsCode(
  phone: string,
): Promise<ApiResp<{ sent: boolean; devCode?: string; expiresIn?: number }>> {
  return request('/api/v1/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, channel: 'login' }),
  });
}

export function phoneLogin(
  phone: string,
  code: string,
): Promise<ApiResp<{ user: User; token: string }>> {
  return request('/api/v1/auth/phone', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export function getMe(): Promise<ApiResp<User | null>> {
  return request('/api/v1/auth/me');
}

export function updateProfile(
  body: { nickname: string },
): Promise<ApiResp<User | null>> {
  return request('/api/v1/auth/profile', { method: 'PATCH', body: JSON.stringify(body) });
}

export interface StatsOverview {
  archivesCount: number;
  totalRecords: number;
  paidRecords: number;
  unlockRate: number;
  totalPlans: number;
  donePlans: number;
  planCompletionRate: number;
  highRiskCount: number;
  lastRecordAt: string | null;
}

export function getStatsOverview(): Promise<ApiResp<StatsOverview>> {
  return request('/api/v1/stats/overview');
}

export function searchCities(q: string): Promise<ApiResp<City[]>> {
  return request(`/api/v1/locations/search?q=${encodeURIComponent(q)}`);
}

export function createArchive(body: Record<string, unknown>): Promise<ApiResp<Archive>> {
  return request('/api/v1/archives', { method: 'POST', body: JSON.stringify(body) });
}

export function getArchive(id: number): Promise<ApiResp<Archive>> {
  return request(`/api/v1/archives/${id}`);
}

export function updateArchive(id: number, body: Record<string, unknown>): Promise<ApiResp<Archive>> {
  return request(`/api/v1/archives/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteArchive(id: number): Promise<ApiResp<{ removedRecords: number }>> {
  return request(`/api/v1/archives/${id}`, { method: 'DELETE' });
}

export function deleteRecord(id: number): Promise<ApiResp<{ removed: boolean }>> {
  return request(`/api/v1/records/${id}`, { method: 'DELETE' });
}

export function listArchives(): Promise<ApiResp<Archive[]>> {
  return request('/api/v1/archives');
}

export function calculate(
  archiveId: number,
  calcType = 'standard',
): Promise<ApiResp<{ recordId: number; report: ReportItem[]; stage: string }>> {
  return request('/api/v1/calculate', {
    method: 'POST',
    body: JSON.stringify({ archiveId, calcType }),
  });
}

export function getRecord(
  id: number,
): Promise<ApiResp<Record<string, unknown> & { report: ReportData; paidStatus?: number }>> {
  return request(`/api/v1/records/${id}`);
}

export interface RecordsPage {
  list: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

export function listRecords(
  page?: number,
  pageSize?: number,
): Promise<ApiResp<Array<Record<string, unknown>> | RecordsPage>> {
  const qs =
    page !== undefined && pageSize !== undefined ? `?page=${page}&pageSize=${pageSize}` : '';
  return request(`/api/v1/records${qs}`);
}

export interface OrderInfo {
  id: number;
  order_no: string;
  amount_cents: number;
  entitlement_status: string;
  created_at: string;
}

export interface UnlockOrderResp {
  order: OrderInfo;
  alreadyUnlocked: boolean;
}

export function createUnlockOrder(recordId: number): Promise<ApiResp<UnlockOrderResp>> {
  return request('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({ recordId }),
  });
}

export function payOrder(
  orderId: number,
  channel = 'mock',
): Promise<ApiResp<{ order: OrderInfo; paidStatus: number }>> {
  return request(`/api/v1/orders/${orderId}/pay`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  });
}

export interface PlanItem {
  id: number;
  level: number;
  title: string;
  content: string;
  exec_cycle: string;
  status: 'pending' | 'done';
  finished_at: string | null;
}

export interface PlansResp {
  plans: PlanItem[];
  doneCount: number;
  total: number;
  locked?: boolean;
  lockedLayers?: number[];
}

export function getPlans(recordId: number): Promise<ApiResp<PlansResp>> {
  return request(`/api/v1/records/${recordId}/plans`);
}

export interface RiskItem {
  id: number;
  record_id: number;
  year: string | null;
  risk_level: number;
  trigger_condition: string;
  mitigation: string;
}

export function getRisks(
  recordId: number,
): Promise<ApiResp<{ risks: RiskItem[]; total: number; locked?: boolean }>> {
  return request(`/api/v1/records/${recordId}/risks`);
}

export function patchPlan(
  planId: number,
  body: { status?: 'done' | 'pending'; note?: string },
): Promise<ApiResp<PlanItem>> {
  return request(`/api/v1/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

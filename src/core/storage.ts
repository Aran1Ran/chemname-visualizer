/**
 * LocalStorage 持久化：练习记录、错题本、设置
 */
export interface PracticeRecord {
  id: string;
  ts: number;
  level: number;
  smiles: string;
  targetName: string;
  answer: string;
  correct: boolean;
  attempts: number;
  errorTypes: string[];
  durationMs: number;
}

const KEY_RECORDS = 'cv.practice.records';
const KEY_SETTINGS = 'cv.settings';

export interface AppSettings {
  skeletonColor: string;
  substituentColor: string;
  hydrogenColor: string;
  background: string;
  defaultView: 'full' | 'skeletal' | 'condensed';
  exportBackground: 'white' | 'transparent';
  exportResolution: '1x' | '2x';
}

export const DEFAULT_SETTINGS: AppSettings = {
  skeletonColor: '#1d4ed8',
  substituentColor: '#dc2626',
  hydrogenColor: '#9ca3af',
  background: '#ffffff',
  defaultView: 'full',
  exportBackground: 'white',
  exportResolution: '2x',
};

export function loadRecords(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(KEY_RECORDS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveRecord(record: PracticeRecord): void {
  const records = loadRecords();
  records.push(record);
  try {
    localStorage.setItem(KEY_RECORDS, JSON.stringify(records.slice(-2000)));
  } catch {
    /* 存储满时静默失败 */
  }
}

export function clearRecords(): void {
  localStorage.removeItem(KEY_RECORDS);
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** 练习统计聚合 */
export interface PracticeStats {
  total: number;
  correct: number;
  accuracy: number;
  byLevel: Array<{ level: number; total: number; correct: number; accuracy: number }>;
  errorTypes: Array<{ type: string; count: number }>;
  recent: PracticeRecord[];
}

export function computeStats(records: PracticeRecord[]): PracticeStats {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  const byLevel = [1, 2, 3, 4, 5, 6].map((level) => {
    const list = records.filter((r) => r.level === level);
    const c = list.filter((r) => r.correct).length;
    return { level, total: list.length, correct: c, accuracy: list.length ? Math.round((c / list.length) * 100) : 0 };
  });
  const errCount = new Map<string, number>();
  for (const r of records) {
    for (const t of r.errorTypes) {
      errCount.set(t, (errCount.get(t) ?? 0) + 1);
    }
  }
  const errorTypes = [...errCount.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    byLevel,
    errorTypes,
    recent: records.slice(-20).reverse(),
  };
}

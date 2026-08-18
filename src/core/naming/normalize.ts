/**
 * 名称输入规范化
 * - 全角 → 半角（，、（）－等）
 * - 去除全部空白
 * - 中文数字 → 阿拉伯数字（位置与倍数）
 * - 容错：'2,3-二甲基' 与 '2，3-二甲基'、'二三-二甲基' 等
 */
import { CN_DIGITS } from './lexicon';

/** 位置串解析：'2,3' / '23'（容错逐位拆分）/ '1,2,3' → [2,3]；中文数字串也支持 */
export function parsePositionString(s: string): number[] {
  const parts = s.split(/[,，]/).filter((x) => x.length > 0);
  if (parts.length > 1) {
    const out: number[] = [];
    for (const p of parts) {
      if (/^\d+$/.test(p)) out.push(parseInt(p, 10));
      else if (/^[一二三四五六七八九十]$/.test(p)) out.push(CN_DIGITS[p]);
    }
    return out;
  }
  const cleaned = s.replace(/[,，]/g, '');
  if (/^\d+$/.test(cleaned)) {
    if (cleaned.length === 1) return [parseInt(cleaned, 10)];
    // 无分隔符多位数字：逐位拆分（高中最多 8 位）
    return cleaned.split('').map((ch) => parseInt(ch, 10));
  }
  if (/^[一二三四五六七八九十]+$/.test(cleaned)) {
    if (cleaned.length === 1) return [CN_DIGITS[cleaned] ?? -1].filter((n) => n > 0);
    // '二三' → [2,3]
    return cleaned
      .split('')
      .map((ch) => CN_DIGITS[ch] ?? -1)
      .filter((n) => n > 0);
  }
  return [];
}

/** 全角 → 半角字符映射 */
const FULL_TO_HALF: Record<string, string> = {
  '，': ',', '、': ',', '．': '.', '。': '.', '（': '(', '）': ')',
  '－': '-', '﹣': '-', '—': '-', '–': '-', '：': ':', '；': ';', '　': ' ',
  '＃': '#', '＝': '=', '＋': '+', '／': '/', '＊': '*',
};

export function fullToHalf(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = FULL_TO_HALF[ch];
    if (c !== undefined) {
      out += c;
    } else {
      // 全角 ASCII（！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～ 以及全角字母数字）
      const code = ch.codePointAt(0)!;
      if (code >= 0xff01 && code <= 0xff5e) {
        out += String.fromCodePoint(code - 0xfee0);
      } else {
        out += ch;
      }
    }
  }
  return out;
}

/** 去除所有空白字符 */
export function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
}

/** 中文数字串 → 数字（仅支持 一~十 单个与 十 组合；用于位置与倍数） */
export function chineseNumberToArabic(s: string): number | null {
  if (s.length === 0) return null;
  // 纯阿拉伯
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // 中文数字
  if (/^[一二三四五六七八九十]+$/.test(s)) {
    if (s === '十') return 10;
    if (s.length === 1) return CN_DIGITS[s] ?? null;
    // 十X / X十 / X十Y
    let total = 0;
    let i = 0;
    const ten = CN_DIGITS['十'];
    while (i < s.length) {
      const ch = s[i];
      if (ch === '十') {
        total += (total === 0 && i === 0 ? 1 : 0) * ten;
        if (i === 0) total = ten;
        else if (total < ten) total += ten; // 五十 → 50
        i++;
      } else {
        const d = CN_DIGITS[ch];
        if (d === undefined) return null;
        if (i + 1 < s.length && s[i + 1] === '十') {
          total += d * ten;
          i += 2;
        } else {
          total += d;
          i++;
        }
      }
    }
    return total;
  }
  return null;
}

/**
 * 将名称中的位置/倍数中文数字替换为阿拉伯数字（保留语义）：
 * - 位置串：'二三-' → '23-'（后续解析器逐位拆分）
 * - 倍数词：'二甲基' → '2甲基'（数字紧跟取代基名/后缀 = 倍数）
 * 注意：不得全局替换——'乙醇'的'乙'是词干而非数字，须由解析器按上下文处理。
 * 因此本函数仅做**位置前缀**（数字后紧跟 '-'）的转换。
 */
export function normalizePositionPrefix(s: string): string {
  return s.replace(/([一二三四五六七八九十]+)(-)/g, (m, digits: string, dash: string) => {
    // '二三' → 每个字一个位置；'二十三' → 23
    if (/^[一二三四五六七八九十]+$/.test(digits)) {
      if (digits.length === 1) {
        const n = chineseNumberToArabic(digits);
        return n !== null ? n + dash : m;
      }
      if (digits.includes('十')) {
        const n = chineseNumberToArabic(digits);
        return n !== null ? n + dash : m;
      }
      // 多位无十：逐位转
      return digits
        .split('')
        .map((ch) => CN_DIGITS[ch] ?? ch)
        .join('') + dash;
    }
    return m;
  });
}

/**
 * 完整规范化管道：全角 → 半角 → 去空白 → 位置前缀数字化
 */
export function normalizeName(raw: string): string {
  return normalizePositionPrefix(stripWhitespace(fullToHalf(raw)));
}

/** 简易编辑距离（用于"无法解析时猜测用户意图"） */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

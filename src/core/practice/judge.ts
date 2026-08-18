/**
 * 反向练习判题：学生输入名称 → 解析 → SMILES 与目标比对
 * 错误反馈具体到：母体/编号/位置/名称/倍数词/官能团
 */
import { parseAndBuild } from '../naming/pipeline';
import { parseSmiles as rdkitParse, initRDKit } from '../rdkit';
import { nameGraph, type NamedResult } from '../reverse/namer';
import { parseSmiles as parseGraph } from '../chem/graph';

export interface JudgeResult {
  correct: boolean;
  /** 用户可见反馈 */
  feedback: string[];
  /** 错误类型（统计分类） */
  errorTypes: string[];
  /** 正确答案（结构规范名） */
  correctName: string;
  /** 学生答案的结构是否可解析 */
  parseOk: boolean;
}

export async function judgeAnswer(targetSmiles: string, studentInput: string): Promise<JudgeResult> {
  await initRDKit();
  const base: JudgeResult = {
    correct: false,
    feedback: [],
    errorTypes: [],
    correctName: '',
    parseOk: false,
  };

  const targetCanonical = await canonicalOf(targetSmiles);
  base.correctName = await nameOf(targetSmiles);

  const p = parseAndBuild(studentInput);
  if (!p.ok || !p.smiles) {
    return {
      ...base,
      feedback: [`无法识别「${studentInput.trim()}」：${p.error?.message ?? ''}`, '请检查名称格式，如「2-甲基丙烷」「乙醇」「乙酸乙酯」。'],
      errorTypes: ['格式错误'],
    };
  }
  base.parseOk = true;

  const studentCanonical = await canonicalOf(p.smiles);
  if (studentCanonical && studentCanonical === targetCanonical) {
    return {
      ...base,
      correct: true,
      feedback: [`回答正确！${studentInput.trim()} 与目标结构一致。`, `规范名称：${base.correctName}`],
    };
  }

  // 结构不同 → 分类诊断
  const studentGraph = parseGraph(p.smiles);
  const targetGraph = parseGraph(targetSmiles);
  const sName = nameGraph(studentGraph);
  const tName = nameGraph(targetGraph);
  const diag = diffNames(sName, tName);
  return { ...base, feedback: diag.feedback, errorTypes: diag.errorTypes };
}

async function canonicalOf(smiles: string): Promise<string | null> {
  const r = await rdkitParse(smiles);
  return r.ok ? r.canonical : null;
}

async function nameOf(smiles: string): Promise<string> {
  const g = parseGraph(smiles);
  const n = nameGraph(g);
  return n.ok ? n.name : '';
}

function diffNames(s: NamedResult, t: NamedResult): { feedback: string[]; errorTypes: string[] } {
  const fb: string[] = [];
  const errs: string[] = [];

  if (!t.ok) {
    fb.push('目标结构无法命名（超出教学范围）。');
    errs.push('其他');
    return { feedback: fb, errorTypes: errs };
  }
  if (!s.ok) {
    fb.push('您的结构无法按命名规则编号，请检查名称。');
    errs.push('其他');
    return { feedback: fb, errorTypes: errs };
  }

  // 1. 官能团类型
  if (s.suffix !== t.suffix) {
    const bothCarbonyl = ['醛', '酮'].includes(t.suffix) && ['醛', '酮'].includes(s.suffix);
    fb.push(
      `官能团判断错误——这是${fgDesc(t.suffix)}，不是${fgDesc(s.suffix)}。` +
        (bothCarbonyl ? '注意：醛基 -CHO 在链端（1 号位），酮羰基 =O 在碳链内部（2 号位起）。' : '')
    );
    errs.push('官能团');
  }

  // 2. 母体（主链长度）
  if (s.parentChainLen !== t.parentChainLen) {
    fb.push(`母体选错了——不是最长碳链，请重新找。提示：最长碳链有 ${t.parentChainLen} 个碳（${stemName(t)}）。`);
    errs.push('母体判断');
  }

  // 3. 编号方向 / 取代基位置
  const tSubs = flatSubs(t);
  const sSubs = flatSubs(s);
  const sNames = new Set(sSubs.map((x) => x.name));
  const tNames = new Set(tSubs.map((x) => x.name));

  // 3a. 漏写/多写取代基名
  for (const tn of tNames) {
    if (!sNames.has(tn)) {
      const tCount = tSubs.filter((x) => x.name === tn).length;
      fb.push(tCount > 1 ? `漏写了「${tn}」及倍数词——结构中有 ${tCount} 个${tn}，应写「${multWord(tCount)}${tn}」。` : `漏写了「${tn}」——结构中有 1 个${tn}。`);
      errs.push('漏写取代基');
    }
  }
  for (const sn of sNames) {
    if (!tNames.has(sn)) {
      fb.push(`取代基名称写错——这个支链是${tSubs[0]?.name ?? '甲基'}，不是${sn}。`);
      errs.push('取代基名称');
    }
  }

  // 3b. 数量（倍数词）——漏写的组已在 3a 报告过，此处跳过避免重复
  for (const tn of tNames) {
    const tc = tSubs.filter((x) => x.name === tn).length;
    const sc = sSubs.filter((x) => x.name === tn).length;
    if (tc !== sc && sc > 0) {
      fb.push(`倍数词错误——有 ${tc} 个${tn}，不是 ${sc} 个。`);
      errs.push('倍数词');
    }
  }

  // 3c. 位置
  // 芳香族二甲苯：邻/间/对 定向反馈
  let aromaticFeedback = false;
  if (t.suffix === '苯' && s.suffix === '苯') {
    const tMe = tSubs.filter((x) => x.name === '甲基').map((x) => x.pos).sort((a, b) => a - b);
    const sMe = sSubs.filter((x) => x.name === '甲基').map((x) => x.pos).sort((a, b) => a - b);
    if (tMe.length === 2 && sMe.length === 2 && tMe.join(',') !== sMe.join(',')) {
      const rel = (ps: number[]): string => {
        const d = Math.abs(ps[0] - ps[1]);
        return d === 1 || d === 5 ? '邻位' : d === 2 || d === 4 ? '间位' : '对位';
      };
      fb.push(`二甲苯的邻/间/对判断错误——两个甲基的相对位置应为${rel(tMe)}（${tMe.join('、')} 号位），您写的是${rel(sMe)}（${sMe.join('、')} 号位）。`);
      errs.push('编号方向');
      aromaticFeedback = true;
    }
  }
  const tPos = tSubs.map((x) => `${x.name}@${x.pos}`).sort();
  const sPos = sSubs.map((x) => `${x.name}@${x.pos}`).sort();
  if (!aromaticFeedback && JSON.stringify(tPos) !== JSON.stringify(sPos) && s.parentChainLen === t.parentChainLen) {
    // 具体位置差
    const mismatches: string[] = [];
    for (const tn of tNames) {
      const tps = tSubs.filter((x) => x.name === tn).map((x) => x.pos);
      const sps = sSubs.filter((x) => x.name === tn).map((x) => x.pos);
      for (const p of tps) {
        if (!sps.includes(p)) {
          mismatches.push(`第 ${p} 号碳上有${tn}，您的编号里没有`);
        }
      }
      for (const p of sps) {
        if (!tps.includes(p)) {
          mismatches.push(`第 ${p} 号碳上没有${tn}，不应写`);
        }
      }
    }
    if (mismatches.length) {
      fb.push(`取代基位置写错——${mismatches.join('；')}。应从离取代基更近的一端编号。`);
      errs.push('编号方向');
    }
  }

  // 官能团位次
  if (s.fgPositions.length && t.fgPositions.length && JSON.stringify(s.fgPositions) !== JSON.stringify(t.fgPositions) && s.suffix === t.suffix) {
    fb.push(`官能团位置写错——${fgDesc(t.suffix)}应在 ${t.fgPositions.join('、')} 号位，不是 ${s.fgPositions.join('、')} 号位。`);
    errs.push('官能团位置');
  }

  if (fb.length === 0) {
    fb.push(`名称与目标结构不一致，请再检查。正确答案：${t.name}。`);
    errs.push('其他');
  }

  fb.push(`正确答案：${t.name}。`);
  return { feedback: fb, errorTypes: [...new Set(errs)] };
}

function flatSubs(n: NamedResult): Array<{ name: string; pos: number }> {
  return n.substituentGroups.flatMap((g) => g.positions.map((p) => ({ name: g.name, pos: p })));
}

function fgDesc(suffix: string): string {
  const map: Record<string, string> = {
    烷: '烷烃', 烯: '烯烃', 炔: '炔烃', 醇: '醇', 醛: '醛', 酮: '酮', 酸: '羧酸', 酯: '酯', 胺: '胺', 苯: '芳香烃', 酚: '酚', 腈: '腈', 醚: '醚',
  };
  return map[suffix] ?? suffix;
}

function multWord(n: number): string {
  return ['一', '二', '三', '四', '五', '六'][n - 1] ?? String(n);
}

function stemName(n: NamedResult): string {
  return n.name.replace(/^[\d,，-]+/, '').replace(/^[一二三四五六七八九十]+/, '');
}

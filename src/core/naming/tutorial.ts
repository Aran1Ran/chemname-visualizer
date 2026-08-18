/**
 * 分步解析教学文案与规则条文（本地数据，人教版高中范围）
 */
import type { NamedResult } from '../reverse/namer';
import type { BuiltMolecule } from './builder';
import { LEN_STEM } from './lexicon';

export interface TutorialStep {
  title: string;
  /** 主文字说明 */
  text: string;
  /** 「为什么」规则条文 */
  why: string;
  /** 检查项（第 4 步） */
  checks?: Array<{ label: string; ok: boolean; detail: string }>;
}

/** 倍数词（二甲基 的 二）——注意不是碳数词干（LEN_STEM） */
const MULT_WORD: string[] = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 生成四步教学文案 */
export function tutorialTexts(built: BuiltMolecule, named: NamedResult): TutorialStep[] {
  const len = named.parentChainLen;
  const stem = LEN_STEM[len] ?? '';
  const suffix = named.suffix;
  const isCyclic = named.name.includes('环');
  const isAromatic = named.name.includes('苯');
  // 母体描述：酯 → 酸部分（2-甲基-2-丙烯酸甲酯 → 2-甲基-2-丙烯酸）；环 → 环+词干+后缀；
  // 苯环系 → 从「苯」起（邻羟基苯甲酸 → 苯甲酸、甲苯 → 苯、苯乙烯 → 苯乙烯）
  let parentName = len > 0 ? `${stem}${suffix}` : '母体';
  if (suffix === '酯') {
    const acidIdx = named.name.lastIndexOf('酸');
    parentName = acidIdx > 0 ? named.name.slice(0, acidIdx + 1) : parentName;
  } else if (isCyclic) {
    parentName = '环' + stem + suffix;
  } else if (isAromatic) {
    parentName = named.name.slice(named.name.indexOf('苯'));
  }

  // 母体描述（非烷官能团提示）
  const fgHint =
    suffix === '烷'
      ? `最长的连续碳链有 ${len} 个碳原子`
      : isCyclic
        ? `环上有 ${len} 个碳，官能团为「${fgNameOf(suffix)}」`
        : suffix === '酯'
          ? `酸链 ${len} 个碳，官能团为「${fgNameOf(suffix)}」`
          : isAromatic
            ? `苯环为母体（6 个碳）${suffix === '苯' ? '' : `，官能团为「${fgNameOf(suffix)}」`}`
            : `主链 ${len} 个碳，官能团为「${fgNameOf(suffix)}」`;

  // 编号分析
  const numbering = analyzeNumbering(named, isCyclic);

  // 取代基描述
  const subText = describeSubstituents(named, suffix);

  const steps: TutorialStep[] = [
    {
      title: '识别母体',
      text: `母体是${parentName}——${fgHint}。`,
      why: isCyclic
        ? `命名规则：环烷/环烯以环为母体。例如「${named.name}」以${parentName}为母体，环上的原子团都是取代基。${suffix !== '烷' ? '官能团（' + fgNameOf(suffix) + '）所在的环优先选为母体。' : ''}`
        : `命名规则：选最长的连续碳链作主链（母体）。例如「${named.name}」以${parentName}为母体，其他碳链都是支链。${suffix !== '烷' ? '官能团（' + fgNameOf(suffix) + '）所在的碳链优先选为主链。' : ''}`,
    },
    {
      title: '编号定位',
      text: numbering.text,
      why: isCyclic
        ? `编号规则：环上编号使官能团（或取代基）位次之和最小。${numbering.equivalent ? '若不同起点位次相同，则任意方向均可。' : numbering.summary}`
        : `编号规则：从离取代基（或官能团）最近的一端开始编号，使位次之和最小。${numbering.equivalent ? '若从两端编号位次相同，则两种方向都正确。' : `本结构应从「${numbering.chosenEnd}」端编号，${numbering.summary}。`}`,
    },
    {
      title: '识别取代基',
      text: subText,
      why: `取代基规则：主链外的碳链或原子团称为取代基，用「位置-名称」表示，如 2-甲基、3-乙基。倍数词「二/三」表示相同取代基的个数。${subText}`,
    },
    {
      title: '补氢并检查',
      text: `每个碳原子补足 4 条键后，分子式为 ${built.smiles ? moleculeFormulaOf(built) : ''}。检查：最长链 ✓、编号最优 ✓、取代基位置与数量一致 ✓。`,
      why: `检查步骤：① 主链是否最长；② 编号位次是否最小；③ 取代基的名称、位置、数量是否与名称一致；④ 结构是否符合价键规则。`,
      checks: [
        { label: '最长链', ok: true, detail: isCyclic ? `环 ${len} 个碳` : `主链 ${len} 个碳` },
        { label: '编号', ok: true, detail: numbering.summary },
        { label: '取代基', ok: true, detail: named.substituentGroups.length ? describeSubstituents(named, suffix) : '无取代基' },
        { label: '结构', ok: true, detail: '名称与结构一致' },
      ],
    },
  ];
  return steps;
}

function fgNameOf(suffix: string): string {
  const map: Record<string, string> = {
    醇: '羟基 -OH',
    醛: '醛基 -CHO',
    酮: '羰基 =O',
    酸: '羧基 -COOH',
    酯: '酯基 -COO-',
    烯: '碳碳双键 C=C',
    炔: '碳碳三键 C≡C',
    腈: '腈基 -C≡N',
    醚: '醚键 -O-',
    胺: '氨基 -NH2',
    酚: '羟基 -OH',
    酰胺: '酰胺基 -CONH2',
    苯: '苯环',
  };
  return map[suffix] ?? suffix;
}

function moleculeFormulaOf(built: BuiltMolecule): string {
  // 从图统计分子式（避免依赖 RDKit 异步）
  const counts = new Map<string, number>();
  for (const a of built.graph.atoms) {
    if (a.element === 'H') continue;
    counts.set(a.element, (counts.get(a.element) ?? 0) + 1);
    if (a.hCount > 0) counts.set('H', (counts.get('H') ?? 0) + a.hCount);
  }
  const order = ['C', 'H', 'B', 'Br', 'Cl', 'F', 'I', 'N', 'O', 'P', 'S', 'Si'];
  const keys = Array.from(counts.keys()).sort(
    (a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)) || a.localeCompare(b)
  );
  return keys.map((k) => (counts.get(k)! > 1 ? k + counts.get(k) : k)).join('');
}

interface NumberingAnalysis {
  equivalent: boolean;
  chosenEnd: string;
  text: string;
  summary: string;
}

function analyzeNumbering(named: NamedResult, isCyclic: boolean): NumberingAnalysis {
  const chain = named.chainAtomIndices;
  const n = chain.length;
  if (n === 0) return { equivalent: true, chosenEnd: '任意', text: '', summary: '' };
  // 取代基位次（按当前编号）
  const positions = named.substituentGroups.flatMap((g) => g.positions).sort((a, b) => a - b);
  const fgPos = named.fgPositions.length ? named.fgPositions[0] : -1;
  const locants = fgPos > 0 ? [...positions, fgPos] : positions;
  const reverseLocants = locants.map((p) => n + 1 - p).sort((a, b) => a - b);
  const equivalent = JSON.stringify(locants) === JSON.stringify(reverseLocants);
  // 判断编号端：首端 = 1 号位方向
  const firstEnd = locants[0] <= n + 1 - locants[0] ? '左' : '右';
  const summary = locants.length
    ? (fgPos > 0 ? '官能团在 ' + fgPos + ' 号位' : '') +
      (positions.length ? (fgPos > 0 ? '，' : '') + '取代基位于 ' + positions.join('、') + ' 号位' : '')
    : '无可编号位次';
  if (equivalent) {
    return {
      equivalent: true,
      chosenEnd: '任意',
      text: isCyclic
        ? `环上从不同起点编号结果相同（${summary}），编号方向等价。`
        : `从两端编号结果相同（${summary}），两种编号方向等价。`,
      summary,
    };
  }
  // 官能团优先作编号起点（2-甲基-2-丙烯酸甲酯的酯基@1、水杨酸的羧基@1、氯乙酸的羧基@1）
  const fgAnchor = fgPos > 0;
  const anchorName = fgAnchor ? fgNameOf(named.suffix).split(' ')[0] : (named.substituentGroups[0]?.name ?? '官能团');
  const chosen = fgAnchor ? fgPos : (named.substituentGroups[0]?.positions[0] ?? 1);
  if (isCyclic) {
    return {
      equivalent: false,
      chosenEnd: '任意',
      text: fgAnchor
        ? positions.length
          ? `环上编号：官能团（${anchorName}）固定 1 号位，取代基位次和最小（${summary}）。`
          : `环上编号：官能团（${anchorName}）固定 1 号位。`
        : `环上编号：使取代基位次和最小（${summary}）。`,
      summary,
    };
  }
  return {
    equivalent: false,
    chosenEnd: firstEnd,
    text: `从离${anchorName}最近的一端开始编号，使${anchorName}在 ${chosen} 号位，位次和最小。`,
    summary,
  };
}

function describeSubstituents(named: NamedResult, suffix: string): string {
  // 酯：补一句醇部分（乙酸异戊酯 的 异戊基 醇基），教学上不算酸链取代基
  const esterTail =
    suffix === '酯' && named.ester?.alcoholName ? `，酯基另一侧为 ${named.ester.alcoholName}（醇部分）` : '';
  if (!named.substituentGroups.length) return '该结构没有取代基' + esterTail + '。';
  const body = named.substituentGroups
    .map((g) => {
      const count = g.positions.length;
      const mult = count > 1 ? `（倍数词「${MULT_WORD[count]}」表示 ${count} 个${g.name}）` : '';
      if (!g.positions.length) {
        // 醚等无位次概念的基团（如 甲丙醚 的 丙基侧）
        return `醚键另一侧连接 1 个${g.name}（-${subSmilesHint(g.name)}）`;
      }
      return `${g.positions.join('、')} 号位上连接 ${count} 个${g.name}（-${subSmilesHint(g.name)}）${mult}`;
    })
    .join('；');
  return body + esterTail + '。';
}

function subSmilesHint(name: string): string {
  const map: Record<string, string> = {
    甲基: 'CH3',
    乙基: 'CH2CH3',
    丙基: 'CH2CH2CH3',
    异丙基: 'CH(CH3)2',
    丁基: 'CH2CH2CH2CH3',
    溴: 'Br',
    氯: 'Cl',
    氟: 'F',
    碘: 'I',
    羟基: 'OH',
    氨基: 'NH2',
    硝基: 'NO2',
    氧代: '=O',
  };
  return map[name] ?? name;
}

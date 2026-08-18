/**
 * SMILES 输入教学提示（官能团高亮等 SMILES 输入场景共用）
 */
export const SMILES_HINTS: Array<{ example: string; desc: string }> = [
  { example: 'CCO', desc: '乙醇（单键省略：C-C-O 写为 CCO）' },
  { example: 'C=C', desc: '碳碳双键用 = 表示（乙烯）' },
  { example: 'C#C', desc: '碳碳三键用 # 表示（乙炔）' },
  { example: 'C=CC=C', desc: '1,3-丁二烯（两个双键）' },
  { example: 'CC(C)C', desc: '括号表示支链（2-甲基丙烷）' },
  { example: 'CC(=O)O', desc: '乙酸（=O 是双键氧）' },
  { example: 'c1ccccc1', desc: '苯环写法（小写 c 表示芳香碳）' },
  { example: 'CC(=O)OCC', desc: '乙酸乙酯（酯基）' },
];

/** 常见错误写法 → 针对性提示 */
export function smileHintForError(input: string): string | null {
  const s = input.trim();
  // 含"烯/双键/双"等字样但无 = 号 → 双键提示
  if (/[烯双]/.test(s) && !s.includes('=') && !/^c\d|^C\d/.test(s)) {
    return '碳碳双键请用 "=" 表示，例如：C=C（乙烯）、C=CC=C（1,3-丁二烯）、CC(=O)O（乙酸）。';
  }
  // 含"炔/三键"但无 # → 三键提示
  if (/[炔三键]/.test(s) && !s.includes('#') && !s.includes('=')) {
    return '碳碳三键请用 "#" 表示，例如：C#C（乙炔）、CC#CC（2-丁炔）。';
  }
  // 分子式误作 SMILES（如 C2H4、C2H6O）→ 提示用结构式写法
  if (/^[C][0-9]+[HO]?[0-9]*$/.test(s) || /^C\d+H\d+/.test(s)) {
    return '这里需要输入 SMILES（结构式写法），不是分子式。例如乙醇写 CCO，乙烯写 C=C；双键用 "=" 表示。';
  }
  // 含空格/中文 → 提示切换"中文名称"输入或去掉空格
  if (/[\u4e00-\u9fff]/.test(s)) {
    return '输入框中含中文：若想按中文名称输入，请切换到上方"中文名称"方式；SMILES 中不支持中文。';
  }
  return null;
}

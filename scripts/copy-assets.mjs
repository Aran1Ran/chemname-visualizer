// 将 RDKit 的 WASM 复制到 public/，确保打包后离线可加载（硬性约束）
// 由 predev / prebuild 钩子调用
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules', '@rdkit', 'rdkit', 'dist', 'RDKit_minimal.wasm');
const destDir = join(root, 'public');
const dest = join(destDir, 'RDKit_minimal.wasm');

if (!existsSync(src)) {
  console.error('[copy-assets] 未找到 ' + src + '，请先执行 npm install');
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[copy-assets] RDKit_minimal.wasm -> public/ (' + dest + ')');

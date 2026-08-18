/**
 * @rdkit/rdkit 类型补充：UMD 主文件默认导出即 RDKitLoader。
 * 本文件有顶层 import，因此 `declare module` 为模块增强（augmentation），
 * 与包自带 dist/index.d.ts 的具名导出合并。
 */
import type { RDKitLoader } from '@rdkit/rdkit';

declare module '@rdkit/rdkit' {
  const initRDKit: RDKitLoader;
  export default initRDKit;
}

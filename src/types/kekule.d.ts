/**
 * Kekule.js 1.0.4 轻量类型声明（仅声明本项目使用的 API 表面）。
 * 注意：本文件是 script（无顶层 import/export），因此 `declare module` 为环境模块声明，
 * 可与真实模块解析合并。Kekule 通过 npm 本地引入，运行时不依赖任何外部资源。
 */

declare module 'kekule' {
  export interface KekuleCoord {
    x: number;
    y: number;
    z?: number;
  }

  export interface KekuleAtom {
    getElement(): string;
    getAtomicNum(): number;
    getCoord2D(): KekuleCoord | null;
    getCoord3D(): KekuleCoord | null;
    setCoord2D(x: number, y: number): void;
    setCoord3D(x: number, y: number, z: number): void;
    isH(): boolean;
    /** 显示用渲染选项（如 color） */
    setRenderOption(key: string, value: unknown): void;
    getRenderOption(key: string): unknown;
    getParent(): KekuleMolecule | null;
  }

  export interface KekuleBond {
    getAtom1(): KekuleAtom;
    getAtom2(): KekuleAtom;
    getBondOrder(): number;
  }

  export interface KekuleMolecule {
    getNodes(): KekuleAtom[];
    getAtoms(): KekuleAtom[];
    getBonds(): KekuleBond[];
    getNodeCount(): number;
    getBondCount(): number;
    getFormula(): { toString(): string } | string;
    calcFormula(): void;
    /** 化学对象渲染选项（如分子显示类型） */
    setRenderOption(key: string, value: unknown): void;
    getRenderOption(key: string): unknown;
  }

  export interface KekuleRenderContext {
    canvas: HTMLCanvasElement;
    [key: string]: unknown;
  }

  export interface KekuleRenderer {
    draw(
      context: KekuleRenderContext,
      baseCoord: KekuleCoord | null,
      options?: Record<string, unknown>
    ): void;
    estimateRenderBox(
      context: KekuleRenderContext,
      baseCoord: KekuleCoord | null,
      options?: Record<string, unknown>,
      allowCoordBorrow?: boolean
    ): { x1: number; y1: number; x2: number; y2: number } | null;
    transformCoordToContext(
      context: KekuleRenderContext,
      chemObj: unknown,
      coord: KekuleCoord
    ): KekuleCoord;
    transformContextCoordToScreen(
      context: KekuleRenderContext,
      coord: KekuleCoord
    ): KekuleCoord;
    setRedirectContext?(context: KekuleRenderContext): void;
    clear?(context: KekuleRenderContext): void;
  }

  export interface MoleculeDisplayConfigs {
    getDefMoleculeDisplayType(): number;
    setDefMoleculeDisplayType(v: number): void;
    getDefNodeDisplayMode(): number;
    setDefNodeDisplayMode(v: number): void;
    getDefHydrogenDisplayLevel(): number;
    setDefHydrogenDisplayLevel(v: number): void;
  }

  export interface RenderColorConfigs {
    getAtomColor(): string;
    setAtomColor(c: string): void;
    getBondColor(): string;
    setBondColor(c: string): void;
    getBackgroundColor(): string;
    setBackgroundColor(c: string): void;
    getHeteroAtomColor(): string;
    setHeteroAtomColor(c: string): void;
  }

  export interface RenderLengthConfigs {
    getUnitLength(): number;
    setUnitLength(v: number): void;
    getBondLineWidth(): number;
    setBondLineWidth(v: number): void;
  }

  export interface Render2DConfigsInstance {
    getMoleculeDisplayConfigs(): MoleculeDisplayConfigs;
    getColorConfigs(): RenderColorConfigs;
    getLengthConfigs(): RenderLengthConfigs;
  }

  export interface CanvasRendererBridgeInstance {
    createContext(
      parentElem: HTMLElement,
      width: number,
      height: number,
      params?: Record<string, unknown>
    ): KekuleRenderContext;
    releaseContext(context: KekuleRenderContext): void;
    setContextDimension(context: KekuleRenderContext, width: number, height: number): void;
    clearContext(context: KekuleRenderContext): void;
  }

  export interface KekuleNamespace {
    IO: {
      loadFormatData(content: string, formatId: string, options?: Record<string, unknown>): KekuleMolecule;
      saveFormatData(chemObj: KekuleMolecule, formatId: string, options?: Record<string, unknown>): string;
    };
    Render: {
      CanvasRendererBridge: new () => CanvasRendererBridgeInstance;
      CompositeMolecule2DRenderer: new (
        chemObj: KekuleMolecule,
        drawBridge: unknown,
        renderConfigs?: unknown,
        parent?: unknown
      ) => KekuleRenderer;
      MoleculeDisplayType: { SKELETAL: number; CONDENSED: number; DEFAULT: number };
      HydrogenDisplayLevel: {
        NONE: number;
        EXPLICIT: number;
        UNMATCHED_EXPLICIT: number;
        ALL: number;
        LABELED: number;
        DEFAULT: number;
      };
      NodeLabelDisplayMode: { HIDDEN: number; SHOWN: number; SMART: number; DEFAULT: number };
      RendererType: { R2D: number; R3D: number; DEFAULT: number };
      Render2DConfigs: new () => Render2DConfigsInstance;
      RenderConfigs: new () => Render2DConfigsInstance;
      /** 获取 2D 渲染配置单例 */
      getRender2DConfigs(): Render2DConfigsInstance;
      /** 按对象类型选择 2D 渲染器类 */
      get2DRendererClass?(obj: unknown): new (
        chemObj: KekuleMolecule,
        drawBridge: unknown,
        renderConfigs?: unknown,
        parent?: unknown
      ) => KekuleRenderer;
      RenderOptionUtils?: {
        convert2DConfigsToPlainHash(configs: Render2DConfigsInstance): Record<string, unknown>;
      };
    };
    Chem: {
      Molecule: new () => KekuleMolecule;
      Atom: new () => KekuleAtom;
    };
    version: string;
    [key: string]: unknown;
  }

  export const Kekule: KekuleNamespace;
  export const Class: unknown;
  export const ClassEx: unknown;
  export const ObjectEx: unknown;
  export const DataType: unknown;
}

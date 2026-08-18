/**
 * 通用 UI 组件：Button / Card / SectionTitle / Hint / InlineSvg（内联图标）
 */
import React from 'react';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark border-transparent',
    secondary: 'bg-white text-ink border-gray-300 hover:bg-gray-50',
    ghost: 'bg-transparent text-ink-soft hover:bg-gray-100 border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent',
  };
  const sizes: Record<string, string> = {
    sm: 'text-[13px] px-4 py-2.5',
    md: 'text-[14px] px-4 py-2.5',
    lg: 'text-[15px] px-5 py-2.5',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors select-none disabled:opacity-45 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, title, subtitle, actions }: {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className ?? ''}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div>
            <div className="text-[15px] font-semibold text-ink">{title}</div>
            {subtitle && <div className="text-[12.5px] text-ink-soft mt-0.5">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children && <div className="p-4">{children}</div>}
    </div>
  );
}

/** 提示条（错误/信息/成功） */
export function Hint({ kind = 'info', children, closable, onClose, className }: {
  kind?: 'info' | 'warn' | 'error' | 'success';
  children: React.ReactNode;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const styles: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-[13.5px] leading-relaxed ${styles[kind]} ${className ?? ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1">{children}</div>
        {closable && (
          <button type="button" onClick={onClose} className="text-current opacity-60 hover:opacity-100 text-sm leading-none mt-0.5">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/** 折叠面板（"为什么"） */
export function Collapse({ label, children, defaultOpen }: { label: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-medium text-ink-soft hover:bg-gray-100 bg-gray-50/60 transition-colors"
      >
        <span>{label}</span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && <div className="px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink bg-white border-t border-gray-200">{children}</div>}
    </div>
  );
}

/** 步骤指示器 */
export function StepIndicator({ total, current, labels }: { total: number; current: number; labels?: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-semibold border-2 transition-colors ${
                active ? 'bg-primary text-white border-primary' : done ? 'bg-primary-light text-primary-dark border-primary' : 'bg-white text-ink-soft border-gray-300'
              }`}
            >
              {done ? '✓' : i + 1}
            </div>
            {i < total - 1 && <div className={`h-0.5 w-5 ${i < current ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-[15px] font-semibold text-ink mb-2 ${className ?? ''}`}>{children}</h3>;
}

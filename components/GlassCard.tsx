import { cx } from "../lib/utils";

export type GlassCardProps = {
  className?: string;
  children: React.ReactNode;
};

export default function GlassCard({ className, children }: GlassCardProps) {
  return (
    <div
      className={cx(
        "bg-glass rounded-2xl border border-slate-600/40 p-6 shadow-[0_0_30px_rgba(15,23,42,0.5)]",
        className
      )}
    >
      {children}
    </div>
  );
}

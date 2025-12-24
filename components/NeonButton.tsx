import { cx } from "../lib/utils";

export type NeonButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export default function NeonButton({
  children,
  onClick,
  className,
  type = "button",
  disabled = false,
}: NeonButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full px-6 py-3 font-semibold text-cyan-200 transition",
        "bg-slate-950/70 shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        "hover:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 opacity-70 blur-sm transition group-hover:opacity-100" />
      <span className="absolute inset-[1px] rounded-full bg-slate-950/80" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

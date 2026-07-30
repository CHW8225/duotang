type QualityBadgeProps = {
  value: string;
  tone?: "neutral" | "attention" | "positive";
};

export function QualityBadge({ value, tone = "neutral" }: QualityBadgeProps) {
  return <span className={`quality-badge quality-badge--${tone}`}>{value || "未记录"}</span>;
}

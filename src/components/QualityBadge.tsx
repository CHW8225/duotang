type QualityBadgeProps = {
  value: string;
  originalValue?: string;
  tone?: "neutral" | "attention" | "positive";
};

export function QualityBadge({ value, originalValue, tone = "neutral" }: QualityBadgeProps) {
  return <span className={`quality-badge quality-badge--${tone}`} title={originalValue}>{value || "未记录"}</span>;
}

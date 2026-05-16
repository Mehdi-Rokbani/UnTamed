export function formatTnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)} TND`;
}

export function formatTndMinor(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "0.00 TND";
  return formatTnd(amount / 100);
}

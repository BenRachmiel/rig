export function isValidYear(value: string): boolean {
  return value === "" || /^\d{4}$/.test(value);
}

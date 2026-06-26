export function countTextLength(value: string) {
  return Array.from(value).length;
}

export function limitTextLength(value: string, maxLength: number) {
  if (countTextLength(value) <= maxLength) {
    return value;
  }

  return Array.from(value).slice(0, maxLength).join('');
}

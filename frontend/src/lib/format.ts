function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function toLocaleDateOnly(date: Date) {
  return date.toLocaleDateString('sv-SE');
}

export function normalizeDateInputValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return '';
    }

    const matchedDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

    if (matchedDate) {
      return matchedDate;
    }

    const parsed = new Date(trimmed);
    return isValidDate(parsed) ? toLocaleDateOnly(parsed) : '';
  }

  if (value instanceof Date) {
    return isValidDate(value) ? toLocaleDateOnly(value) : '';
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? toLocaleDateOnly(parsed) : '';
  }

  return '';
}

export function formatDate(value?: unknown, fallback = '-') {
  const normalized = normalizeDateInputValue(value);
  return normalized || fallback;
}

export function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) return fallback;

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed.toLocaleString('sv-SE') : fallback;
}

export function formatDuration(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function statusLabel(status: string) {
  return status === 'approved' ? '已通过' : status === 'rejected' ? '已驳回' : '待审核';
}

export function notificationLabel(type: string) {
  return type === 'approved'
    ? '审核通过'
    : type === 'rejected'
      ? '审核驳回'
      : type === 'deleted'
        ? '记录删除'
        : '系统通知';
}

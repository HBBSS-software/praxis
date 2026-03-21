export function formatDate(value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString('sv-SE');
}

export function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return new Date(value).toLocaleString('sv-SE');
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

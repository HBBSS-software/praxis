import { toast } from 'sonner';

export function getErrorMessage(error: unknown, fallback = '操作失败。') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function toastSuccess(message: string) {
  toast.success(message);
}

export function toastError(error: unknown, fallback?: string) {
  toast.error(getErrorMessage(error, fallback));
}

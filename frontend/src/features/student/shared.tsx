import { CalendarDays, CheckCircle2, Clock3, Eye, ImagePlus, MapPin, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useSession } from '@/lib/auth';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { AuthenticatedImage } from '@/shared/authenticated-image';
import { DatePickerField } from '@/shared/date-picker-field';
import { EmptyState } from '@/shared/empty-state';
import { StatCard } from '@/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiResponseError, createApiClient, formatUploadImageMaxSize, getRuntimeConfig, unwrapResponse, uploadImage, validateUploadImageFiles } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/feedback';
import { formatDate, formatDateTime, formatDuration, normalizeDateInputValue, notificationLabel, statusLabel } from '@/lib/format';
import { MAX_RECORD_IMAGES, type AppNotification, type RecordStatistics, type StudentRecord } from '@/lib/types';

export function StudentPageFrame({
  title,
  description,
  action,
  children
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-52 items-center justify-center gap-3 p-6 text-sm text-[color:var(--muted-foreground)]">
        <Spinner />
        {label}
      </CardContent>
    </Card>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-rose-700">{message}</p>
        {onRetry ? <Button variant="secondary" onClick={onRetry}>重新加载</Button> : null}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'outline'}>
      {statusLabel(status)}
    </Badge>
  );
}

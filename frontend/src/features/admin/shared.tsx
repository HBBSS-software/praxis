import { ArrowDown, ArrowUp, ChevronDown, FileUp, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  useComboboxAnchor
} from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/auth';
import { ApiResponseError, createApiClient, importUserCsv, unwrapResponse } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/feedback';
import { formatDateTime, formatDuration } from '@/lib/format';
import { useShiftMultiSelect } from '@/lib/shift-selection';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { ClassAssignments, ClassSummary, CreatedUser, CreatedUserPayload, CreatedUsersPayload, CsvImportEntry, CsvImportPreview, StudentSummary, StudentWithClassSummary, TeacherStatistics, UserRole, UserSummary } from '@/lib/types';
import { EmptyState } from '@/shared/empty-state';
import { UserCredentialsResult } from '@/shared/user-credentials-result';

export const comboboxPageSize = 50;

export type CredentialsResult = {
  users: CreatedUser[];
  credentialsCsv: string;
};

export function AdminPageFrame({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
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

export function SelectClass({
  classes,
  value,
  disabled,
  onChange
}: {
  classes: ClassSummary[];
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label="班级">
      <Select
        value={value ? String(value) : '__none__'}
        disabled={disabled}
        onValueChange={(nextValue) => onChange(nextValue === '__none__' ? null : Number(nextValue))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="班级" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">不分配班级</SelectItem>
          {classes.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name} ({item.cid})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function formatStudentClass(student: Pick<StudentWithClassSummary, 'class_cid' | 'class_name'>) {
  return student.class_cid && student.class_name ? `${student.class_cid} ${student.class_name}` : <span className="text-muted-foreground">未分配</span>;
}

export function getStudentClassSortValue(student: Pick<StudentWithClassSummary, 'class_cid'>) {
  return student.class_cid ?? null;
}

export function compareStudentClass(left: Pick<StudentWithClassSummary, 'class_cid' | 'uid'>, right: Pick<StudentWithClassSummary, 'class_cid' | 'uid'>, direction: 'asc' | 'desc') {
  const leftClass = getStudentClassSortValue(left);
  const rightClass = getStudentClassSortValue(right);

  if (!leftClass && !rightClass) return left.uid.localeCompare(right.uid);
  if (!leftClass) return 1;
  if (!rightClass) return -1;

  const result = leftClass.localeCompare(rightClass) || left.uid.localeCompare(right.uid);
  return direction === 'asc' ? result : -result;
}

export function SortButton({
  active,
  descending,
  label,
  onClick
}: {
  active: boolean;
  descending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="inline-flex items-center gap-1 font-medium" type="button" onClick={onClick}>
      {label}
      {active ? descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : null}
    </button>
  );
}

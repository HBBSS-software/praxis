import { ArrowLeft, GraduationCap, LockKeyhole, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxPagedSearch
} from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  loginStaff,
  loginStudentByName,
  loginStudentByUid,
  searchLoginClasses,
  selectLoginCandidate,
  validatePlainPassword,
  type LoginCandidate,
  type LoginResponse
} from '@/lib/api';
import { useSession } from '@/lib/auth';
import { toastError } from '@/lib/feedback';
import { getDefaultPathByRole } from '@/lib/session';
import { useRuntimeConfig, useSiteName } from '@/lib/runtime-config';
import { SiteFooter } from '@/shared/site-footer';

interface LoginClass {
  id: number;
  name: string;
  created_at: string;
}

type PendingSelection = {
  challenge: string;
  candidates: LoginCandidate[];
} | null;

function isSelectionResponse(value: LoginResponse): value is { challenge: string; candidates: LoginCandidate[] } {
  return 'challenge' in value;
}

function useLoginCompletion() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [selection, setSelection] = useState<PendingSelection>(null);
  const [selecting, setSelecting] = useState(false);

  function finish(data: { user: Parameters<typeof signIn>[0] }, password: string) {
    signIn(data.user, data.user.password_setup_required ? password : null);

    if (data.user.password_setup_required) {
      toast('请先设置密码。');
    }

    navigate(getDefaultPathByRole(data.user.role, data.user.password_setup_required), { replace: true });
  }

  function handleResponse(data: LoginResponse, password: string) {
    if (isSelectionResponse(data)) {
      setSelection({ challenge: data.challenge, candidates: data.candidates });
      return;
    }

    finish(data, password);
  }

  async function selectCandidate(uid: number, password: string) {
    if (!selection) return;

    try {
      setSelecting(true);
      const data = await selectLoginCandidate(selection.challenge, uid);
      setSelection(null);
      finish(data, password);
    } catch (error) {
      toastError(error, '登录失败。');
    } finally {
      setSelecting(false);
    }
  }

  return { selection, setSelection, selecting, handleResponse, selectCandidate };
}

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <Card className="lg:self-center">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <LockKeyhole className="size-6" />
          </div>
          <CardTitle className="text-2xl">登录系统</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button className="h-12 justify-start gap-3" onClick={() => navigate('/login/student')}>
            <GraduationCap className="size-5" />
            我是学生
          </Button>
          <Button className="h-12 justify-start gap-3" variant="outline" onClick={() => navigate('/login/staff')}>
            <UsersRound className="size-5" />
            我是老师 / 管理员
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export function StudentLoginPage() {
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const loginCompletion = useLoginCompletion();
  const [uid, setUid] = useState('');
  const [uidPassword, setUidPassword] = useState('');
  const [name, setName] = useState('');
  const [namePassword, setNamePassword] = useState('');
  const [selectedClass, setSelectedClass] = useState<LoginClass | null>(null);
  const [classes, setClasses] = useState<LoginClass[]>([]);
  const [loading, setLoading] = useState<'uid' | 'name' | null>(null);
  const classSearch = useComboboxPagedSearch<LoginClass>({ items: classes, pageSize: 50, debounceDelay: 250 });

  useEffect(() => {
    let ignored = false;

    searchLoginClasses(classSearch.debouncedQuery)
      .then((data) => {
        if (!ignored) setClasses(data.classes);
      })
      .catch((error) => {
        if (!ignored) toastError(error, '搜索班级失败。');
      });

    return () => {
      ignored = true;
    };
  }, [classSearch.debouncedQuery]);

  return (
    <AuthLayout>
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="w-fit px-2" onClick={() => navigate('/login')}>
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <CardTitle className="text-2xl">学生登录</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="name">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="name">姓名</TabsTrigger>
              <TabsTrigger value="uid">UID</TabsTrigger>
            </TabsList>
            <TabsContent value="name" className="mt-5">
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!selectedClass) {
                    toastError(new Error('请选择班级。'));
                    return;
                  }
                  if (!name.trim()) {
                    toastError(new Error('姓名不能为空。'));
                    return;
                  }
                  const passwordError = validatePlainPassword(namePassword, runtimeConfig, { enforcePolicy: false });
                  if (passwordError) {
                    toastError(new Error(passwordError));
                    return;
                  }
                  try {
                    setLoading('name');
                    const data = await loginStudentByName(selectedClass.id, name.trim(), namePassword);
                    loginCompletion.handleResponse(data, namePassword);
                  } catch (error) {
                    toastError(error, '登录失败。');
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                <ClassCombobox search={classSearch} value={selectedClass} onChange={setSelectedClass} />
                <Field label="姓名" icon={<UserRound className="size-4" />}>
                  <Input value={name} onChange={(event) => setName(event.target.value)} className="pl-10" />
                </Field>
                <PasswordField value={namePassword} onChange={setNamePassword} />
                <SubmitButton loading={loading === 'name'} />
              </form>
            </TabsContent>
            <TabsContent value="uid" className="mt-5">
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const parsedUid = Number(uid.trim());
                  if (!Number.isInteger(parsedUid) || parsedUid <= 0) {
                    toastError(new Error('UID 无效。'));
                    return;
                  }
                  const passwordError = validatePlainPassword(uidPassword, runtimeConfig, { enforcePolicy: false });
                  if (passwordError) {
                    toastError(new Error(passwordError));
                    return;
                  }
                  try {
                    setLoading('uid');
                    const data = await loginStudentByUid(parsedUid, uidPassword);
                    loginCompletion.handleResponse(data, uidPassword);
                  } catch (error) {
                    toastError(error, '登录失败。');
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                <Field label="UID" icon={<UserRound className="size-4" />}>
                  <Input inputMode="numeric" value={uid} onChange={(event) => setUid(event.target.value)} className="pl-10" />
                </Field>
                <PasswordField value={uidPassword} onChange={setUidPassword} />
                <SubmitButton loading={loading === 'uid'} />
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <CandidateDialog
        password={namePassword || uidPassword}
        selection={loginCompletion.selection}
        selecting={loginCompletion.selecting}
        onOpenChange={(open) => !open && loginCompletion.setSelection(null)}
        onSelect={loginCompletion.selectCandidate}
      />
    </AuthLayout>
  );
}

export function StaffLoginPage() {
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const loginCompletion = useLoginCompletion();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <AuthLayout>
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="w-fit px-2" onClick={() => navigate('/login')}>
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <UsersRound className="size-5" />
          </div>
          <CardTitle className="text-2xl">老师 / 管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!identifier.trim()) {
                toastError(new Error('UID / 姓名不能为空。'));
                return;
              }
              const passwordError = validatePlainPassword(password, runtimeConfig, { enforcePolicy: false });
              if (passwordError) {
                toastError(new Error(passwordError));
                return;
              }
              try {
                setLoading(true);
                const data = await loginStaff(identifier.trim(), password);
                loginCompletion.handleResponse(data, password);
              } catch (error) {
                toastError(error, '登录失败。');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="UID / 姓名" icon={<UserRound className="size-4" />}>
              <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="pl-10" />
            </Field>
            <PasswordField value={password} onChange={setPassword} />
            <SubmitButton loading={loading} />
          </form>
        </CardContent>
      </Card>
      <CandidateDialog
        password={password}
        selection={loginCompletion.selection}
        selecting={loginCompletion.selecting}
        onOpenChange={(open) => !open && loginCompletion.setSelection(null)}
        onSelect={loginCompletion.selectCandidate}
      />
    </AuthLayout>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  const siteName = useSiteName();

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-6 sm:py-8">
      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-md gap-4 sm:gap-5">
          <div className="text-center text-sm font-medium text-muted-foreground">
            {siteName}
          </div>
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="密码" icon={<LockKeyhole className="size-4" />}>
      <Input type="password" value={value} onChange={(event) => onChange(event.target.value)} className="pl-10" />
    </Field>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button className="h-11 w-full" disabled={loading} type="submit">
      {loading ? <Spinner className="size-4 text-current" /> : null}
      {loading ? '登录中...' : '登录'}
    </Button>
  );
}

function ClassCombobox({
  search,
  value,
  onChange
}: {
  search: ReturnType<typeof useComboboxPagedSearch<LoginClass>>;
  value: LoginClass | null;
  onChange: (value: LoginClass | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>班级</Label>
      <Combobox
        items={search.visibleItems}
        value={value}
        inputValue={search.query}
        onInputValueChange={search.setQuery}
        filter={null}
        itemToStringLabel={(item) => item.name}
        itemToStringValue={(item) => item.name}
        onValueChange={(nextValue) => onChange(nextValue)}
      >
        <ComboboxInput className="w-full" placeholder="搜索班级" showClear />
        <ComboboxContent>
          <ComboboxEmpty>没有找到班级</ComboboxEmpty>
          <ComboboxList onScroll={search.loadMoreItems}>
            <ComboboxGroup items={search.visibleItems}>
              <ComboboxCollection>
                {(item: LoginClass) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.name}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

function CandidateDialog({
  password,
  selection,
  selecting,
  onOpenChange,
  onSelect
}: {
  password: string;
  selection: PendingSelection;
  selecting: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (uid: number, password: string) => void;
}) {
  return (
    <Dialog open={Boolean(selection)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择账号</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {selection?.candidates.map((candidate) => (
            <Button
              key={candidate.uid}
              type="button"
              variant="outline"
              className="h-auto justify-between gap-3 px-4 py-3 text-left"
              disabled={selecting}
              onClick={() => onSelect(candidate.uid, password)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{candidate.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{candidate.english_name || '未填写英文名'}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">UID {candidate.uid}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

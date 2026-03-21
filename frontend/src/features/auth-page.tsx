import { LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api';
import { getDefaultPathByRole } from '@/lib/session';
import { useSession } from '@/lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_minmax(380px,460px)]">
        <div className="hidden rounded-xl border bg-card p-8 shadow-sm lg:block">
          <div className="flex h-full flex-col justify-between">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                社会实践系统
              </div>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">一套系统，搞定社会实践全流程。</h1>
                <p className="max-w-lg text-base text-muted-foreground">统一操作入口，让实践提交更便捷、审核更透明、管理更省心。</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['流程清晰', '实践提交、审核流转、通知反馈集中在一处，状态变化随时可追踪。'],
                ['数据集中', '学生实践记录、教师审核意见统一存储，减少分散查找与重复核对，敏感信息加密存储，全方位保障数据安全。'],
                ['操作高效', '支持批量审核、智能筛选、自动提醒、数据导出等功能，大幅减轻重复工作，提升效率。']
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-base font-semibold">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LockKeyhole className="size-6" />
            </div>
            <CardTitle className="text-2xl">登录系统</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                setLoading(true);

                try {
                  const data = await login(uid.trim(), password);
                  signIn(data.token, data.user);
                  navigate(getDefaultPathByRole(data.user.role), { replace: true });
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : '登录失败。');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="uid">UID</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="uid" value={uid} onChange={(event) => setUid(event.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" />
                </div>
              </div>
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
              <Button className="h-11 w-full" disabled={loading} type="submit">
                {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

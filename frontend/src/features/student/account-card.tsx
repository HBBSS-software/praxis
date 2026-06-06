import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiResponseError, createApiClient, unwrapResponse, validatePlainPassword } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { toastError, toastSuccess } from '@/lib/feedback';
import { useRuntimeConfig } from '@/lib/runtime-config';
import { Field, StudentPageFrame } from './shared';

export function StudentAccountPage() {
  return <AccountCard allowNameChange={false} />;
}

export function AccountCard({
  allowNameChange
}: {
  allowNameChange: boolean;
}) {
  const { user, signOut } = useSession();
  const runtimeConfig = useRuntimeConfig();
  const [nameForm, setNameForm] = useState({ name: user?.name ?? '', current_password: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [submitting, setSubmitting] = useState('');

  return (
    <StudentPageFrame
      title="账号设置"
      className="mx-auto w-full max-w-2xl"
    >
      <div className="space-y-6">
        {allowNameChange ? (
          <Card>
            <CardHeader>
              <CardTitle>修改姓名</CardTitle>
              <CardDescription>保存后请重新登录。</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const passwordError = validatePlainPassword(nameForm.current_password, runtimeConfig, { enforcePolicy: false });

                  if (passwordError) {
                    toastError(new Error(passwordError));
                    return;
                  }

                  setSubmitting('name');
                  try {
                    await unwrapResponse(createApiClient().auth.profile.put(nameForm));
                    toastSuccess('姓名修改成功，重新登录后生效。');
                    setNameForm((current) => ({ ...current, current_password: '' }));
                  } catch (nextError) {
                    if (nextError instanceof ApiResponseError && nextError.status === 401) {
                      signOut();
                      return;
                    }
                    toastError(nextError, '操作失败。');
                  } finally {
                    setSubmitting('');
                  }
                }}
              >
                <Field label="新姓名">
                  <Input value={nameForm.name} onChange={(event) => setNameForm((current) => ({ ...current, name: event.target.value }))} required />
                </Field>
                <Field label="当前密码">
                  <Input type="password" value={nameForm.current_password} onChange={(event) => setNameForm((current) => ({ ...current, current_password: event.target.value }))} required />
                </Field>
                <Button disabled={submitting === 'name'} type="submit">{submitting === 'name' ? '提交中...' : '保存姓名'}</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>修改后请使用新密码登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  toastError(new Error('两次输入的密码不一致。'));
                  return;
                }

                const currentPasswordError = validatePlainPassword(passwordForm.current_password, runtimeConfig, { enforcePolicy: false });
                const newPasswordError = validatePlainPassword(passwordForm.new_password, runtimeConfig);

                if (currentPasswordError || newPasswordError) {
                  toastError(new Error(currentPasswordError ?? newPasswordError ?? '密码无效。'));
                  return;
                }

                setSubmitting('password');
                try {
                  await unwrapResponse(
                    createApiClient().auth.password.put({
                      current_password: passwordForm.current_password,
                      new_password: passwordForm.new_password
                    })
                  );
                  toastSuccess('密码修改成功。');
                  setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                } catch (nextError) {
                  if (nextError instanceof ApiResponseError && nextError.status === 401) {
                    signOut();
                    return;
                  }
                  toastError(nextError, '修改失败。');
                } finally {
                  setSubmitting('');
                }
              }}
            >
              <Field label="当前密码">
                <Input type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} required />
              </Field>
              <Field label="新密码">
                <Input type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))} required />
              </Field>
              <Field label="确认密码">
                <Input type="password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))} required />
              </Field>
              <Button disabled={submitting === 'password'} type="submit">
                {submitting === 'password' ? '提交中...' : '保存密码'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StudentPageFrame>
  );
}

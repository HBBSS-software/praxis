import { AccountCard } from '@/features/student/account-card';

export function AccountSettingsPage({ allowNameChange }: { allowNameChange: boolean }) {
  return <AccountCard title="账号信息" allowNameChange={allowNameChange} />;
}

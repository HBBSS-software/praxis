import { AccountCard } from '@/features/student/account-card';

export function AccountSettingsPage({ allowNameChange }: { allowNameChange: boolean }) {
  return <AccountCard allowNameChange={allowNameChange} />;
}

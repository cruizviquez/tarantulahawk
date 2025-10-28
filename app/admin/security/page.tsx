import { getAuthUser, getUserProfile } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import SecurityDashboard from '@/app/components/SecurityDashboard';

export default async function AdminSecurityPage() {
  const { user } = await getAuthUser();
  const profile = await getUserProfile(user.id);

  // Verify admin role
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return <SecurityDashboard />;
}

import { getAuthUser, getUserProfile } from '@/app/lib/auth';
import AdminDashboard from '@/app/components/AdminDashboard';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const { user } = await getAuthUser();
  const profile = await getUserProfile(user.id);

  // Check if user is admin
  if (!profile || profile.role !== 'admin') {
    redirect('/?error=unauthorized');
  }

  return <AdminDashboard />;
}

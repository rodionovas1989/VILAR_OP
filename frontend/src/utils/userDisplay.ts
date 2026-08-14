export type UserRef = { id: string; name: string };

export function userDisplayName(users: UserRef[], userId?: string | null): string {
  if (!userId) return '—';
  const user = users.find((u) => u.id === userId);
  return user?.name || userId;
}

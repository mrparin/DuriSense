export type SessionUser = {
  full_name: string;
  roles: string[];
};

export function workspacePath(user: Pick<SessionUser, "roles">): string {
  return user.roles.includes("ADMIN") ? "/admin/users" : "/farms";
}

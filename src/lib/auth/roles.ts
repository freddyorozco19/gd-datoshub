import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "leader" | "user";

/** Lee el rol desde app_metadata (controlado solo por service-role). */
export function roleOf(user: User | null | undefined): Role {
  const r = (user?.app_metadata as { role?: string } | undefined)?.role;
  return r === "admin" ? "admin" : r === "leader" ? "leader" : "user";
}

/** Devuelve el usuario autenticado (o null) desde la sesión server-side. */
export async function getAuthedUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Roles que pueden gestionar quién está activo en Presales. */
export const canManagePresales = (user: User | null | undefined) => {
  const r = roleOf(user);
  return !!user && (r === "admin" || r === "leader");
};

/**
 * Garantiza que quien llama sea admin.
 * Devuelve el usuario admin, o null si no hay sesión / no es admin.
 */
export async function requireAdmin(): Promise<User | null> {
  const user = await getAuthedUser();
  if (!user || roleOf(user) !== "admin") return null;
  return user;
}

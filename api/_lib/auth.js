import { createClient } from "@supabase/supabase-js";

export async function getUserClient(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return { error: { status: 401, message: "Please sign in to manage published websites." } };
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { error: { status: 503, message: "Account service is not configured." } };
  }

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { error: { status: 401, message: "Your session is invalid or expired. Please sign in again." } };
  }

  return { client, user: data.user };
}

import { withDeadline } from "./verification-actions.js";

const uncertain = {
  login: "Sign-in could not be confirmed. Check your connection and try signing in again.",
  signup: "Account creation could not be confirmed. Check your email before trying again.",
  recovery: "The reset email could not be confirmed. Check your inbox and spam folder before requesting another.",
  logout: "Sign-out could not be confirmed. Check your connection and try again.",
};

export async function runAuthAction(client, action, values = {}, { timeoutMs = 15000 } = {}) {
  if (!Object.hasOwn(uncertain, action)) throw Error("Choose a valid account action.");
  const email = String(values.email || "").trim();
  let result;
  try {
    result = await withDeadline((async () => {
      if (action === "login") return client.auth.signInWithPassword({ email, password: values.password });
      if (action === "signup") return client.auth.signUp({ email, password: values.password, options: { emailRedirectTo: values.redirectTo } });
      if (action === "recovery") return client.auth.resetPasswordForEmail(email, { redirectTo: values.redirectTo });
      return client.auth.signOut();
    })(), timeoutMs);
  } catch { throw Error(uncertain[action]); }
  if (!result || result.error) throw Error(result?.error?.message || uncertain[action]);
  if (action === "login" && (!result.data?.session?.access_token || !result.data?.user?.id)) throw Error(uncertain.login);
  if (action === "signup" && !result.data?.user?.id) throw Error(uncertain.signup);
  return result.data;
}

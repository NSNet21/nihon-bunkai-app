import {
  buildAuthEmailRedirectTo,
  mapAuthEmailError,
} from './auth-email-confirmation';

type AuthErrorLike = { message?: string | null } | null;

type SupabaseSignUpClient = {
  auth: {
    signUp: (credentials: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<{ data: { user: unknown | null; session: unknown | null }; error: AuthErrorLike }>;
  };
};

type SupabaseResendClient = {
  auth: {
    resend: (credentials: {
      type: 'signup';
      email: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<{ error: AuthErrorLike }>;
  };
};

type SupabaseMagicLinkClient = {
  auth: {
    signInWithOtp: (credentials: {
      email: string;
      options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
    }) => Promise<{ error: AuthErrorLike }>;
  };
};

type SupabasePasswordClient = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ error: AuthErrorLike }>;
  };
};

export async function signUpWithEmailConfirmation(
  client: SupabaseSignUpClient,
  email: string,
  password: string,
  currentUrl?: string | null,
): Promise<{ error: string | null; needsEmailConfirm: boolean }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: buildAuthEmailRedirectTo(currentUrl) },
  });
  if (error) return { error: mapAuthEmailError(error.message) ?? error.message ?? null, needsEmailConfirm: false };
  return { error: null, needsEmailConfirm: !data.session && !!data.user };
}

export async function resendSignUpConfirmationEmail(
  client: SupabaseResendClient,
  email: string,
  currentUrl?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: buildAuthEmailRedirectTo(currentUrl) },
  });
  return { error: mapAuthEmailError(error?.message) };
}

export async function signInWithExistingUserMagicLink(
  client: SupabaseMagicLinkClient,
  email: string,
  currentUrl?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildAuthEmailRedirectTo(currentUrl),
      shouldCreateUser: false,
    },
  });
  return { error: mapAuthEmailError(error?.message) };
}

export async function signInWithConfirmedPassword(
  client: SupabasePasswordClient,
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  return { error: mapAuthEmailError(error?.message) };
}

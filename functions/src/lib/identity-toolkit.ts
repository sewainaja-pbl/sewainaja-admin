const IDENTITY_TOOLKIT_BASE_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

export interface SignInResult {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email: string;
}

export class IdentityToolkitError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export const signInWithPassword = async (
  email: string,
  password: string,
): Promise<SignInResult> => {
  const apiKey = process.env.FIREBASE_IDENTITY_TOOLKIT_API_KEY || 'AIzaSyCJCr3VkZBlqFTbBF0EfnLheSO5hhP5jdw';

  if (!apiKey) {
    throw new IdentityToolkitError(
      'MISSING_API_KEY',
      'FIREBASE_IDENTITY_TOOLKIT_API_KEY belum diatur',
    );
  }

  const response = await fetch(`${IDENTITY_TOOLKIT_BASE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const json = (await response.json()) as {
    error?: { message?: string };
    idToken?: string;
    refreshToken?: string;
    expiresIn?: string;
    localId?: string;
    email?: string;
  };

  if (!response.ok || !json.idToken || !json.localId) {
    const code = json.error?.message ?? 'UNKNOWN';
    throw new IdentityToolkitError(code, 'Login gagal');
  }

  return {
    idToken: json.idToken,
    refreshToken: json.refreshToken ?? '',
    expiresIn: json.expiresIn ?? '',
    localId: json.localId,
    email: json.email ?? email,
  };
};

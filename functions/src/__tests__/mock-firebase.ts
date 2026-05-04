import type { UserDoc } from '../types/auth';

type StoredUser = UserDoc & {
  createdAt: unknown;
  updatedAt: unknown;
};

const users = new Map<string, StoredUser>();
const authUsersByEmail = new Map<
  string,
  {
    uid: string;
    email: string;
    password: string;
    displayName?: string;
    phoneNumber?: string;
  }
>();
const tokenClaims = new Map<string, Record<string, unknown>>();

const toStoredUser = (value: Partial<UserDoc> & { id: string }): StoredUser => ({
  id: value.id,
  name: value.name ?? '',
  email: value.email ?? '',
  phone: value.phone ?? '',
  isOwner: value.isOwner ?? false,
  isRenter: value.isRenter ?? false,
  isAdmin: value.isAdmin ?? false,
  status: value.status ?? 'pending',
  ktpPhotoUrl: value.ktpPhotoUrl ?? '',
  selfiePhotoUrl: value.selfiePhotoUrl ?? '',
  avgRatingAsRenter: value.avgRatingAsRenter ?? 0,
  avgRatingAsOwner: value.avgRatingAsOwner ?? 0,
  totalTransactions: value.totalTransactions ?? 0,
  fcmToken: value.fcmToken ?? '',
  createdAt: value.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: value.updatedAt ?? new Date('2025-01-01T00:00:00.000Z'),
});

const seedAuthUser = (record: {
  uid: string;
  email: string;
  password: string;
  displayName?: string;
  phoneNumber?: string;
}) => {
  authUsersByEmail.set(record.email, record);
  return record;
};

const seedUser = (value: Partial<UserDoc> & { id: string }) => {
  const stored = toStoredUser(value);
  users.set(stored.id, stored);
  if (stored.email) {
    seedAuthUser({
      uid: stored.id,
      email: stored.email,
      password: 'password123',
      displayName: stored.name,
      phoneNumber: stored.phone,
    });
  }
  return stored;
};

const reset = () => {
  users.clear();
  authUsersByEmail.clear();
  tokenClaims.clear();
};

const collection = (name: string) => {
  if (name !== 'users') {
    throw new Error(`Unexpected collection: ${name}`);
  }

  return {
    doc: (id: string) => ({
      set: async (value: StoredUser) => {
        users.set(id, { ...value, id });
      },
      get: async () => {
        const value = users.get(id);
        return {
          exists: Boolean(value),
          data: () => value ?? null,
        };
      },
      update: async (patch: Partial<StoredUser>) => {
        const current = users.get(id);
        if (!current) {
          throw new Error('missing user');
        }
        users.set(id, { ...current, ...patch });
      },
    }),
    where: (field: string, op: string, value: unknown) => {
      if (field !== 'status' || op !== '==') {
        throw new Error(`Unexpected query: ${field} ${op}`);
      }

      const query = {
        orderBy: (_field: string, _direction: string) => query,
        limit: (count: number) => ({
          get: async () => {
            const docs = [...users.values()]
              .filter((user) => user.status === value)
              .sort((a, b) => {
                const left = new Date(a.createdAt as Date).getTime();
                const right = new Date(b.createdAt as Date).getTime();
                return left - right;
              })
              .slice(0, count)
              .map((doc) => ({ data: () => doc }));

            return { docs };
          },
        }),
      };

      return query;
    },
  };
};

export const mockFirebaseAdmin = {
  auth: {
    getUserByEmail: async (email: string) => {
      const user = authUsersByEmail.get(email);
      if (!user) {
        throw new Error('not-found');
      }
      return user;
    },
    createUser: async (input: {
      email: string;
      password: string;
      displayName?: string;
      phoneNumber?: string;
    }) => {
      const uid = `uid-${users.size + authUsersByEmail.size + 1}`;
      const record = seedAuthUser({ uid, ...input });
      return { uid: record.uid };
    },
    deleteUser: async (uid: string) => {
      for (const [email, record] of authUsersByEmail.entries()) {
        if (record.uid === uid) {
          authUsersByEmail.delete(email);
        }
      }
    },
    verifyIdToken: async (token: string) => {
      const claims = tokenClaims.get(token);
      if (!claims) {
        throw new Error('invalid-token');
      }
      return { uid: token, ...claims, email: `${token}@example.com` };
    },
  },
  firestore: () => ({
    collection,
  }),
  __state: {
    users,
    authUsersByEmail,
    tokenClaims,
    seedAuthUser,
    seedUser,
    reset,
  },
};

export const mockIdentityToolkit = {
  signInWithPassword: async (email: string, password: string) => {
    const user = authUsersByEmail.get(email);
    if (!user || user.password !== password) {
      const error = new Error('Login gagal') as Error & { code?: string };
      error.code = !user ? 'EMAIL_NOT_FOUND' : 'INVALID_PASSWORD';
      throw error;
    }

    return {
      idToken: `token-${user.uid}`,
      refreshToken: `refresh-${user.uid}`,
      expiresIn: '3600',
      localId: user.uid,
      email: user.email,
    };
  },
  IdentityToolkitError: class extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  },
};

export const mockState = {
  seedAuthUser,
  seedUser,
  reset,
  tokenClaims,
};

import type { UserDoc } from '../types/auth';

type StoredUser = UserDoc & {
  createdAt: unknown;
  updatedAt: unknown;
};

type StoredDispute = {
  id: string;
  transactionId: string;
  reportedBy: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: unknown;
  resolvedAt: unknown | null;
  reporterName: string;
  renterName: string;
  itemNames: string[];
  updatedAt?: unknown;
};

const users = new Map<string, StoredUser>();
const disputes = new Map<string, StoredDispute>();
const transactions = new Map<string, any>();
const payments = new Map<string, any>();
const admin_tasks = new Map<string, any>();

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
  profilePhotoUrl: value.profilePhotoUrl ?? '',
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

const seedDispute = (value: Partial<StoredDispute> & { id: string }) => {
  const stored: StoredDispute = {
    id: value.id,
    transactionId: value.transactionId ?? 'trx-1',
    reportedBy: value.reportedBy ?? 'uid-reporter',
    description: value.description ?? '',
    status: value.status ?? 'open',
    resolutionNote: value.resolutionNote ?? null,
    resolvedBy: value.resolvedBy ?? null,
    createdAt: value.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    resolvedAt: value.resolvedAt ?? null,
    reporterName: value.reporterName ?? 'Reporter',
    renterName: value.renterName ?? 'Renter',
    itemNames: value.itemNames ?? [],
    updatedAt: value.updatedAt,
  };
  disputes.set(stored.id, stored);

  // Auto seed a default transaction for this transactionId if not present
  if (!transactions.has(stored.transactionId)) {
    transactions.set(stored.transactionId, {
      id: stored.transactionId,
      ownerId: 'uid-owner-seeded',
      renterId: stored.reportedBy,
      status: 'disputed',
      totalPrice: 100000,
    });
  }

  // Auto seed a payment for this transactionId if not present
  if (payments.size === 0) {
    payments.set('p-1', {
      id: 'p-1',
      transactionId: stored.transactionId,
      amount: 100000,
      status: 'paid',
      escrowStatus: 'disputed_locked',
    });
  }

  return stored;
};

const reset = () => {
  users.clear();
  disputes.clear();
  transactions.clear();
  payments.clear();
  admin_tasks.clear();
  authUsersByEmail.clear();
  tokenClaims.clear();
};

const collection = (name: string) => {
  if (name !== 'users' && name !== 'disputes' && name !== 'transactions' && name !== 'payments' && name !== 'admin_tasks') {
    throw new Error(`Unexpected collection: ${name}`);
  }

  let store: Map<string, any>;
  if (name === 'users') {
    store = users;
  } else if (name === 'disputes') {
    store = disputes;
  } else if (name === 'transactions') {
    store = transactions;
  } else if (name === 'admin_tasks') {
    store = admin_tasks;
  } else {
    store = payments;
  }

  const toMillis = (value: unknown) => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') return new Date(value).getTime();
    if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds?: number }).seconds === 'number') {
      return ((value as { seconds: number }).seconds ?? 0) * 1000;
    }
    return new Date(value as never).getTime();
  };

  const where = (field: string, op: string, value: unknown) => {
    const getFilteredDocs = () => {
      let docs = [...store.values()];
      if (field === 'status') {
        if (op === 'in' && Array.isArray(value)) {
          docs = docs.filter((doc) => (value as any[]).includes(doc.status));
        } else {
          docs = docs.filter((doc) => doc.status === value);
        }
      } else if (field === 'transactionId') {
        docs = docs.filter((doc) => doc.transactionId === value);
      } else if (field === 'refId') {
        docs = docs.filter((doc) => doc.refId === value);
      } else if (field === 'type') {
        docs = docs.filter((doc) => doc.type === value);
      } else {
        docs = docs.filter((doc) => doc[field] === value);
      }
      return docs.map((doc) => ({
        id: doc.id,
        ref: {
          update: async (patch: any) => {
            const current = store.get(doc.id);
            store.set(doc.id, { ...current, ...patch });
          },
        },
        data: () => doc,
      }));
    };

    const query = {
      where: (f2: string, op2: string, val2: unknown) => where(f2, op2, val2),
      orderBy: (_field: string, _direction: string) => query,
      limit: (count: number) => ({
        get: async () => {
          const docs = getFilteredDocs().slice(0, count);
          return { docs, empty: docs.length === 0 };
        },
      }),
      get: async () => {
        const docs = getFilteredDocs();
        return { docs, empty: docs.length === 0 };
      },
    };
    return query;
  };

  return {
    doc: (id: string) => ({
      set: async (value: any) => {
        store.set(id, { ...value, id });
      },
      get: async () => {
        const value = store.get(id);
        return {
          exists: Boolean(value),
          data: () => value ?? null,
        };
      },
      update: async (patch: any) => {
        const current = store.get(id);
        if (!current) {
          throw new Error('missing document');
        }
        store.set(id, { ...current, ...patch });
      },
    }),
    where,
    orderBy: (field: string, direction: string) => {
      const query = {
        get: async () => {
          const docs = [...store.values()]
            .sort((a, b) => {
              const left = toMillis((a as { createdAt?: unknown })[field as 'createdAt']);
              const right = toMillis((b as { createdAt?: unknown })[field as 'createdAt']);
              return direction === 'asc' ? left - right : right - left;
            })
            .map((doc) => ({ id: doc.id, data: () => doc }));

          return { docs };
        },
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
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, data: any) => {
          operations.push(async () => {
            await ref.set(data);
          });
        },
        update: (ref: any, data: any) => {
          operations.push(async () => {
            await ref.update(data);
          });
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        },
      };
    },
  }),
  __state: {
    users,
    disputes,
    transactions,
    payments,
    authUsersByEmail,
    tokenClaims,
    seedAuthUser,
    seedUser,
    seedDispute,
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
  seedDispute,
  reset,
  tokenClaims,
};

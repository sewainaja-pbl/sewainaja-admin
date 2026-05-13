import { auth } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type RequestBody = BodyInit | JsonObject | JsonValue[] | null | undefined;

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: RequestBody;
}

interface ApiErrorPayload {
  error?: { message?: string };
  message?: string;
}

export async function fetchWithAuth<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  let body: RequestBody = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`🌐 Fetching: ${API_URL}${endpoint}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    body: body as BodyInit | null | undefined,
    headers,
  });

  const data = (await response.json()) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'API Request failed');
  }

  return data as T;
}

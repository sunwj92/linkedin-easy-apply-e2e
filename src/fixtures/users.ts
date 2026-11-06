import path from 'node:path';
import { env } from '../config/env';

export type UserKey = 'userA' | 'userB';

export interface TestUser {
  key: UserKey;
  email: string;
  password: string;
  displayName: string;
}

export const ALL_USERS: UserKey[] = ['userA', 'userB'];

const mockUsers: Record<UserKey, TestUser> = {
  userA: {
    key: 'userA',
    email: process.env.MOCK_USER_A_EMAIL ?? 'alice.qa@example.com',
    password: env.mockPassword,
    displayName: 'Alice Chen',
  },
  userB: {
    key: 'userB',
    email: process.env.MOCK_USER_B_EMAIL ?? 'bob.qa@example.com',
    password: env.mockPassword,
    displayName: 'Bob Liu',
  },
};

function liveUser(key: UserKey): TestUser {
  const suffix = key === 'userA' ? 'A' : 'B';
  return {
    key,
    email: process.env[`LINKEDIN_USER_${suffix}_EMAIL`] ?? '',
    password: process.env[`LINKEDIN_USER_${suffix}_PASSWORD`] ?? '',
    displayName: key === 'userA' ? 'Live user A' : 'Live user B',
  };
}

export function getUser(key: UserKey): TestUser {
  return env.live ? liveUser(key) : mockUsers[key];
}

export function storageStatePath(key: UserKey): string {
  return path.join(env.authDir, `${env.live ? 'live-' : ''}${key}.json`);
}

export function hasCredentials(key: UserKey): boolean {
  const user = getUser(key);
  return Boolean(user.email && user.password);
}

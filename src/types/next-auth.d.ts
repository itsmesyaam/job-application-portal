import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      googleId?: string;
      isAdmin?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    googleId?: string;
    isAdmin?: boolean;
  }
}

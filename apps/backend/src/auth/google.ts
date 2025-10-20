import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from './constants.js';

let client: OAuth2Client | null = null;

const getClient = () => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }
  if (!client) {
    client = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return client;
};

export interface GoogleProfile {
  email: string;
  sub: string;
  name?: string | null;
  picture?: string | null;
}

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new Error('Invalid Google token payload');
  }
  return {
    email: payload.email,
    sub: payload.sub,
    name: payload.name,
    picture: payload.picture,
  };
};

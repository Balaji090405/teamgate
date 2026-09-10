import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
};

const userPool = new CognitoUserPool(poolData);

export function login(
  email: string,
  password: string,
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (error) => {
        reject(error);
      },
    });
  });
}

export function getCurrentSession(): CognitoUserSession | null {
  const user = userPool.getCurrentUser();

  if (!user) {
    return null;
  }

  let session: CognitoUserSession | null = null;

  user.getSession((error: Error | null, currentSession: CognitoUserSession | null) => {
    if (!error && currentSession) {
      session = currentSession;
    }
  });

  return session;
}

export function getIdToken(): string | null {
  const session = getCurrentSession();

  if (!session || !session.isValid()) {
    return null;
  }

  return session.getIdToken().getJwtToken();
}

export function logout(): void {
  const user = userPool.getCurrentUser();

  if (user) {
    user.signOut();
  }
}

export function getRoleFromToken(): string | null {
  const token = getIdToken();

  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf-8'),
    );

    const groups = payload['cognito:groups'];

    if (Array.isArray(groups)) {
      return groups[0] ?? null;
    }

    if (typeof groups === 'string') {
      return groups;
    }

    return null;
  } catch {
    return null;
  }
}
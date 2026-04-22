import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { findUserById, upsertUser } from "./db.js";

const googleClient = new OAuth2Client();

function getJwtSecret() {
  return process.env.APP_JWT_SECRET || "localai_dev_secret_change_me";
}

export async function loginWithGoogle(idToken) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: audience || undefined,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload?.email || !payload?.name) {
    throw new Error("Token de Google invalido");
  }

  const user = upsertUser({
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });

  const token = jwt.sign({ userId: user.id }, getJwtSecret(), {
    expiresIn: "7d",
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  };
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "Sesion invalida" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

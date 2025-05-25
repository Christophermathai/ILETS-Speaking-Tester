// lib/session.ts
import { IronSessionOptions } from "iron-session";

export const sessionOptions: IronSessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_12345678901234567890",
  cookieName: "questionnaire_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

declare module "iron-session" {
  interface IronSessionData {
    questions?: {
      question1: string;
      question2: string;
      question3: string;
    };
  }
}

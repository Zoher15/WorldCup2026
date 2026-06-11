export interface LoginState {
  status: "idle" | "sent" | "error";
  email?: string;
  error?: string;
}

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };

export interface VerifyState {
  status: "idle" | "error";
  error?: string;
}

export const INITIAL_VERIFY_STATE: VerifyState = { status: "idle" };

export interface LoginState {
  status: "idle" | "sent" | "error";
  email?: string;
  error?: string;
  /** Seconds the user must wait before another code can be requested. */
  retryAfter?: number;
  /** Rough seconds until a queued code lands (set only when it's waiting behind
   *  others under the email rate limit; omitted when it sent immediately). */
  etaSeconds?: number;
}

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };

export interface VerifyState {
  status: "idle" | "error";
  error?: string;
}

export const INITIAL_VERIFY_STATE: VerifyState = { status: "idle" };

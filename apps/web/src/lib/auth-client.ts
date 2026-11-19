"use client";

import { createAuthClient } from "better-auth/react";

/** Better Auth in the browser, on this same origin (`/api/auth`). */
export const authClient = createAuthClient();

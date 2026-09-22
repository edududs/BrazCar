import createClient from "openapi-fetch";

import { apiBaseUrl } from "./base-url";
import type { paths } from "./schema";

// The session is a cookie on the API's sibling origin (ADR-0012): every call carries it.
export const apiClient = createClient<paths>({ baseUrl: apiBaseUrl, credentials: "include" });

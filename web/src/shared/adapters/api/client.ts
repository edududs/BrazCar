import createClient from "openapi-fetch";

import { apiBaseUrl } from "./base-url";
import type { paths } from "./schema";

export const apiClient = createClient<paths>({ baseUrl: apiBaseUrl });

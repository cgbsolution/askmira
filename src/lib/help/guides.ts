import type { PageGuide } from "./index";
import { COMPANY_GUIDES } from "./guides/company";
import { ME_GUIDES } from "./guides/me";
import { ONBOARDING_HR_GUIDES } from "./guides/onboarding-hr";
import { OPERATIONS_GUIDES } from "./guides/operations";

/** Every page's guide, keyed by its route as in lib/access.ts ("[id]" for a dynamic part). */
export const GUIDES: Record<string, PageGuide> = {
  ...ME_GUIDES,
  ...ONBOARDING_HR_GUIDES,
  ...COMPANY_GUIDES,
  ...OPERATIONS_GUIDES,
};

import type { PageGuide } from "../index";

/** Guides for HR's onboarding pages. */
export const ONBOARDING_HR_GUIDES: Record<string, PageGuide> = {
  "/onboarding/plans": {
    summary: "Onboarding for everyone joining: checklists, owners, what is overdue and who is stuck.",
    tasks: [
      {
        title: "Start onboarding for a joiner",
        steps: [
          "Press Start onboarding.",
          "Choose the person, the checklist and their buddy, then start it. View opens a joiner's plan.",
        ],
      },
      {
        title: "Unblock a joiner",
        steps: [
          "Open the joiner's checklist and find overdue tasks.",
          "Use Reassign task or Change due date, or nudge the owner.",
        ],
      },
    ],
    tips: [
      "The Assets and Documents tabs track the laptop and papers for each joiner.",
      "An offer accepted in Hiring can start the default checklist automatically.",
    ],
    related: [{ label: "Checklists", href: "/onboarding/templates" }],
  },

  "/onboarding/templates": {
    summary: "Onboarding checklists: the tasks, who does each, and when relative to the joining date.",
    tasks: [
      {
        title: "Create a checklist",
        steps: [
          "Press New checklist (or Create a standard template to start from the usual one) and add its tasks.",
          "For each task choose the owner (the joiner, manager, buddy, IT, HR or finance) and the day relative to joining.",
          "Mark it Active to use it; Make default starts it automatically when an offer converts.",
        ],
      },
    ],
  },

  "/onboarding/assets": {
    summary: "The equipment each new joiner needs, and whether it has been set aside and handed over.",
    tasks: [
      {
        title: "Set aside an asset for a joiner",
        steps: ["Find the joiner, choose an asset from stock and set it aside; hand it over on day one."],
      },
    ],
    related: [{ label: "Asset register", href: "/assets/inventory" }],
  },

  "/onboarding/documents": {
    summary: "Documents new joiners and their dependants have to provide, and what HR still has to enter or verify.",
    tasks: [
      {
        title: "Enter or verify a joiner's documents",
        steps: ["Choose the joiner, press Add document or open one to enter its details, then Verify or Reject it."],
      },
    ],
    related: [{ label: "Documents", href: "/docs" }],
  },
};

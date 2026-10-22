import type { PageGuide } from "../index";

const HR = ["admin", "sub_admin"] as const;
const MANAGERS = ["admin", "sub_admin", "manager"] as const;

/** Guides for the "Company" pages: people, culture, rewards, performance, hiring. */
export const COMPANY_GUIDES: Record<string, PageGuide> = {
  "/people": {
    summary: "Everyone in the company: names, roles, departments and work contacts.",
    tasks: [
      {
        title: "Find a colleague",
        steps: [
          "Type a name, employee code or email in the search box (or press Ctrl K from anywhere).",
          "Filter by department or location if the list is long.",
          "Open a person to see their profile.",
        ],
      },
      {
        title: "Add people",
        roles: [...HR],
        steps: [
          "People are added under Onboarding → Add employees: one at a time, or many from Excel.",
          "Once added, they appear in this directory.",
        ],
      },
      {
        title: "Export the directory",
        roles: [...HR],
        steps: ["Set the filters you want, then press Export CSV."],
      },
    ],
    tips: ["What you see on a profile depends on your role; personal details are for HR and the person."],
    related: [{ label: "Org chart", href: "/people/org-chart" }],
  },

  "/people/[id]": {
    summary: "One person's record: profile, employment, compensation, documents, leave, attendance and history.",
    tasks: [
      {
        title: "Edit someone's record",
        roles: [...HR],
        steps: [
          "Open the tab you need, such as Personal, Employment or Statutory & bank.",
          "Press Edit, change the details and save. Every change is kept in the Timeline.",
          "Your own record works the same way: as HR you edit it directly, with no change request.",
        ],
      },
      {
        title: "Mark someone's attendance",
        roles: [...HR],
        steps: [
          "Open the Attendance tab, click the day and choose Missed punch, Correct attendance, On duty or Work from home.",
          "Give the times or status and a reason, then Apply. It is applied at once, with no approval; a locked payroll period must be unlocked first.",
        ],
      },
      {
        title: "Change employment (promotion, transfer, confirmation)",
        roles: [...HR],
        steps: [
          "Open the Lifecycle tab and start the change.",
          "Choose the type, effective date and new values, and preview the letter.",
          "Submit it for approval; it is applied on the effective date.",
        ],
      },
    ],
    tips: [
      "Leave and Attendance tabs show the person's balances and days.",
      "Timeline is the full history of changes to the record.",
    ],
    related: [{ label: "Lifecycle events", href: "/people/lifecycle" }],
  },

  "/onboarding/new": {
    summary: "Add people: one at a time with a short form, or many at once from Excel.",
    tasks: [
      {
        title: "Add one person",
        steps: [
          "Stay on One person and fill the three steps: basic details, job details, then checklist and login.",
          "Press Add joiner. Their record, checklist and login are created together.",
        ],
      },
      {
        title: "Add many from Excel",
        steps: [
          "Open Many from Excel. Upload your factoHR Employee Detail file as it is, or fill in the template (Download template).",
          "Press Check file and read the result. Nothing is saved yet.",
          "Press Import.",
        ],
      },
    ],
    tips: [
      "Employee codes already in AskMira are skipped, so a corrected file can be imported again.",
      "A value that fails a check (a mistyped PAN, say) is left out and listed; the rest of the row still comes in.",
    ],
    related: [
      { label: "New joiners", href: "/onboarding/plans" },
      { label: "Directory", href: "/people" },
    ],
  },

  "/people/org-chart": {
    summary: "Who reports to whom and, for HR and managers, every approved seat including vacant ones.",
    tasks: [
      {
        title: "Explore the reporting lines",
        steps: ["Open Reporting lines; filter by team or location, and use Expand or Collapse. Print or Export CSV take it away."],
      },
      {
        title: "See positions and vacancies",
        roles: [...MANAGERS],
        steps: ["Open Positions & vacant seats to see every approved seat, filled or empty."],
      },
    ],
  },

  "/people/positions": {
    summary: "Approved seats, who holds them, what is vacant, and what the headcount budget allows.",
    tasks: [
      {
        title: "Review vacancies and budget",
        steps: [
          "Open Vacancies for seats with nobody in them.",
          "Open Headcount budget to compare filled seats with the budget; Set a budget or Revise it, and Add cost centre.",
        ],
      },
      {
        title: "Model a change",
        steps: [
          "Open Scenarios and press New.",
          "Press Add change for new seats or moves, tick Include cost, and Commit it when decided (or Discard).",
        ],
      },
    ],
    tips: ["New position adds an approved seat; each seat has actions to edit or close it."],
  },

  "/people/lifecycle": {
    summary:
      "Confirmations, transfers, promotions and other employment changes: previewed, approved, and applied on their effective date.",
    tasks: [
      {
        title: "Follow a change",
        steps: [
          "Open the Events tab to see each change and its approval status; press Raise event to start one.",
          "Open one to approve, reject or cancel it. Apply due events applies approved changes whose date has come.",
        ],
      },
      {
        title: "Make the same change for many people",
        steps: ["Open Batches and press New batch, add the people and the change, then submit it."],
      },
      {
        title: "Handle probation",
        steps: ["Open the Probation tab for reviews that are due; set the policy and Send due reminders."],
      },
    ],
  },

  "/people/exits": {
    summary: "Resignations, clearance and last working days, and why people leave.",
    tasks: [
      {
        title: "Start an exit",
        roles: [...HR],
        steps: [
          "Press Start an exit and choose the person.",
          "Set the reason and last working day; the clearance checklist starts.",
        ],
      },
      {
        title: "Decide a resignation from your team",
        steps: ["Open the exit, agree the last working day or suggest another, and approve."],
      },
      {
        title: "Set up the exit checklist",
        roles: [...HR],
        steps: ["Open Checklist setup, press Add item, choose who signs it off and whether it is mandatory."],
      },
    ],
    tips: [
      "Why people leave summarises exit interviews.",
      "Notice recovery shows pay to recover for notice not served.",
    ],
    related: [{ label: "Full & final", href: "/payroll/settlements" }],
  },

  "/people/clearance": {
    summary: "Sign-offs that wait on you when a colleague leaves.",
    tasks: [
      {
        title: "Sign off a clearance item",
        steps: [
          "Open the item (for example “Laptop returned”).",
          "Confirm it is done, add a note or an amount to recover, and sign it off.",
        ],
      },
    ],
  },

  "/people/change-requests": {
    summary: "Changes employees asked for to their IDs, bank account, address, nominees and legal name.",
    tasks: [
      {
        title: "Approve or reject a change",
        steps: [
          "Compare the old and new values and any proof.",
          "Press Approve to update the record, or Reject with a reason.",
        ],
      },
    ],
  },

  "/culture": {
    summary: "Recognition, awards and the moments people chose to share.",
    tasks: [
      {
        title: "Give a shoutout",
        steps: [
          "Search for a colleague to thank, and write what they did.",
          "Choose the company value it shows (or No value) and who sees it, then press Post.",
        ],
      },
      {
        title: "Share your birthday or work anniversary",
        steps: ["Tick “Share my birthday” or “Share my work anniversary” so the company can celebrate it."],
      },
    ],
    tips: ["React to a shoutout with an emoji to show you agree."],
    related: [{ label: "Awards", href: "/culture/awards" }],
  },

  "/culture/clubs": {
    summary: "Groups people start around what they care about outside the job description.",
    tasks: [
      {
        title: "Join or start a club",
        steps: [
          "In All clubs, press Join on a club (or Open to read it first).",
          "To start one, press Start a club and describe it.",
        ],
      },
      {
        title: "Post in a club",
        steps: ["Open a club you belong to and post in it. Members shows who is in; Leave takes you out."],
      },
    ],
  },

  "/culture/awards": {
    summary: "Nominate people for work that deserves more than a thank-you, and see who won.",
    tasks: [
      {
        title: "Nominate someone",
        steps: [
          "In Award cycles, press Nominate on a running cycle.",
          "Choose the person and write why, then submit it.",
        ],
      },
      {
        title: "Score nominations as a juror",
        steps: ["Open the cycle and press Score on each nomination."],
      },
      {
        title: "Run an award programme",
        roles: [...HR],
        steps: [
          "In Programmes, press New programme.",
          "Press Open a cycle with its dates and jurors, then Manage it to close it and announce winners.",
        ],
      },
    ],
  },

  "/culture/surveys": {
    summary: "Say how it really is. Your answers cannot be connected to you, not by your manager and not by HR.",
    tasks: [
      {
        title: "Answer a survey",
        steps: ["Open My surveys and press Answer on a survey, then submit; Results shows a closed survey's results."],
      },
      {
        title: "Create and close a survey",
        roles: [...HR],
        steps: [
          "Open Manage surveys and press New survey.",
          "Add questions, choose who it is for and the dates, then launch it.",
          "Close it when done to see results above the anonymity threshold.",
        ],
      },
      {
        title: "Act on results",
        roles: [...MANAGERS],
        steps: ["Open Action plans and press New plan for a theme, with an owner and due date."],
      },
    ],
    tips: ["Results for any group smaller than the reporting threshold are never shown to anyone."],
  },

  "/culture/announcements": {
    summary: "What the company wants everyone to know.",
    tasks: [
      {
        title: "Read and acknowledge",
        steps: ["Open For me; press I have read this on announcements that ask for it."],
      },
      {
        title: "Publish an announcement",
        roles: [...HR],
        steps: [
          "Open Publish & track and press New announcement.",
          "Write it, choose the audience and whether it needs acknowledgement, then publish.",
          "Press Who has read it to track it.",
        ],
      },
    ],
  },

  "/culture/polls": {
    summary: "Quick questions to the company, and events to answer.",
    tasks: [
      {
        title: "Vote in a poll or answer an event",
        steps: ["Open Polls to vote, or Events to say whether you will come."],
      },
      {
        title: "Ask a question or create an event",
        steps: [
          "Press Ask a question, add the options, and tick Anonymous if votes should be secret.",
          "Or press New event, set the date and place, and publish.",
        ],
      },
    ],
  },

  "/culture/admin": {
    summary: "Company values, whether they are lived, and whether survey feedback was acted on.",
    tasks: [
      {
        title: "Define company values",
        steps: ["Open the Values tab, add each value with a short description, and keep it Active."],
      },
      {
        title: "Set up work anniversary messages",
        steps: [
          "Open Work anniversaries and add the years to mark.",
          "Write the message; {name}, {years} and {company} are filled in. Save.",
        ],
      },
    ],
    tips: ["Values in practice shows how often each value is tagged in shoutouts."],
  },

  "/rewards": {
    summary: "Your reward points: what you were given, what they are worth, and when they expire.",
    tasks: [
      {
        title: "Redeem points",
        steps: [
          "Press Redeem.",
          "Choose an item from the catalogue and confirm; HR fulfils it.",
        ],
      },
      {
        title: "Award points to someone",
        roles: [...MANAGERS],
        steps: ["Press Award points, choose the person and the points, and say why."],
      },
    ],
    tips: ["Expiring soon shows points that will lapse if you do not use them."],
  },

  "/rewards/admin": {
    summary: "The points liability, budgets, catalogue, redemptions, valuation, tax treatment and partner reconciliation.",
    tasks: [
      {
        title: "Set budgets and the point value",
        steps: [
          "Open Budgets and press New budget for the company or a manager.",
          "In Value, expiry & tax: New rate sets what a point is worth, Save expiry policy sets when points lapse, Add rule sets the tax treatment.",
        ],
      },
      {
        title: "Fulfil redemptions",
        steps: ["Open Redemptions and mark each one fulfilled or rejected. Add catalogue items under Catalogue with Add an item."],
      },
    ],
    tips: ["Employee ledger shows every award and redemption per person."],
  },

  "/performance": {
    summary: "Your review, the score your goals contribute, and your history.",
    tasks: [
      {
        title: "Write your self-review",
        steps: [
          "Open the current review.",
          "Rate yourself against each goal and competency and add comments.",
          "Press Save draft as you go, and Submit self review before the due date.",
        ],
      },
      {
        title: "Acknowledge your review",
        steps: ["When your manager shares the review, read it and press Acknowledge, or Send back with a note."],
      },
    ],
    related: [{ label: "Goals", href: "/performance/goals" }],
  },

  "/performance/goals": {
    summary: "Objectives with measurable key results. Their progress is the goal score in your review.",
    tasks: [
      {
        title: "Add a goal",
        steps: [
          "Press New goal and add its key results.",
          "For each key result choose a number target or “Done / not done”, the start value and weight.",
        ],
      },
      {
        title: "Check in on progress",
        steps: ["Press Check in on a goal, update the key results, and add a note. Show progress history lists earlier check-ins; Complete closes the goal."],
      },
    ],
    tips: ["My team and Company tabs show the goals your role can see."],
  },

  "/performance/one-on-ones": {
    summary: "Regular conversations between you and your manager or your reports.",
    tasks: [
      {
        title: "Schedule a 1:1",
        steps: ["Press Schedule a 1:1, choose the person, date and agenda, and save."],
      },
      {
        title: "Record a 1:1",
        steps: ["Open it, add notes and action items, and press Mark as held. Reschedule if it moves."],
      },
    ],
  },

  "/performance/feedback": {
    summary: "Feedback from colleagues, and private notes between you and a colleague.",
    tasks: [
      {
        title: "Ask for feedback",
        steps: ["Press Ask for feedback, choose the people and what you want feedback on."],
      },
      {
        title: "Give feedback",
        steps: ["Open To give to answer requests, or press Give feedback to send some unasked."],
      },
    ],
  },

  "/performance/team": {
    summary: "Reviews in your reporting line, who is holding each, and what is late.",
    tasks: [
      {
        title: "Complete your team's reviews",
        steps: ["Open Reviews and press Review on each person, rate them and submit."],
      },
      {
        title: "Chase late reviews",
        steps: ["Press Remind pending, or Escalate overdue for reviews past their date."],
      },
      {
        title: "Delegate while away",
        steps: ["Open Delegation and press Delegate my steps: who handles your review steps, and until when."],
      },
    ],
  },

  "/performance/calibration": {
    summary: "A live session to agree ratings across a group, with the distribution and the evidence behind each person.",
    tasks: [
      {
        title: "Run a calibration session",
        steps: [
          "Press New session and choose the cycle and scope.",
          "Open it, compare the distribution with the target, and look at each person's Evidence.",
          "Press Change to move a rating, with a reason.",
        ],
      },
    ],
  },

  "/performance/increments": {
    summary: "Recommend increments within the rating's band, with the budget left and the pay-equity view in front of you.",
    tasks: [
      {
        title: "Recommend an increment",
        steps: [
          "Open the increment cycle and the person.",
          "Press Recommend, enter the increment within the suggested band, and see the budget left.",
          "Use Apply promotion if it comes with a promotion; Revise changes a recommendation.",
        ],
      },
      {
        title: "Open an increment cycle",
        roles: [...HR],
        steps: ["Press New increment cycle, set the budget and bands, and open it. Approve recommendations, then Release letters."],
      },
    ],
  },

  "/performance/pips": {
    summary: "Improvement plans with written expectations, support given and check-ins that capture both sides.",
    tasks: [
      {
        title: "Open an improvement plan",
        steps: ["Press Open a plan, choose the person and write the milestones and the support you will give."],
      },
      {
        title: "Check in and close",
        steps: [
          "Record check-ins as you go; the person can add their own account.",
          "Assess each milestone, then Record the outcome.",
        ],
      },
    ],
  },

  "/performance/cycles": {
    summary: "Configure, launch, run and close review cycles, and keep probation reviews on each person's own clock.",
    tasks: [
      {
        title: "Launch a review cycle",
        steps: [
          "Press New cycle and set the period, due dates and template.",
          "Add assignment rules for who reviews whom, then launch it.",
        ],
      },
      {
        title: "Close a cycle",
        steps: [
          "Open the cycle and choose Close the cycle.",
          "Tick “Release every completed review to its employee” if they should see it now.",
        ],
      },
    ],
    tips: [
      "Probation reviews are due on each person's own probation end date; Schedule due in 30 days creates them.",
      "Run daily sweep sends reminders and moves late steps on now, instead of waiting for the night.",
    ],
  },

  "/performance/competencies": {
    summary: "What people are rated against, and what each level looks like.",
    tasks: [
      {
        title: "Set up competencies and scales",
        steps: [
          "In Rating scales, press New scale (tick Allow decimal ratings if needed).",
          "In Competencies, press New competency and describe each level.",
          "In Templates, press New template to group competencies for a role.",
        ],
      },
    ],
  },

  "/hiring": {
    summary: "Roles the organisation is hiring for. A requisition takes candidates only after its approval chain signs it off.",
    tasks: [
      {
        title: "Raise a requisition",
        steps: [
          "Press Raise requisition with the role, department, openings and budget.",
          "Submit it for approval; it opens for candidates once approved.",
        ],
      },
      {
        title: "Approve a requisition",
        steps: ["Find it among what is waiting on you and press Approve, or Reject with a reason."],
      },
    ],
    tips: ["Tick “Only mine” to see just your requisitions."],
    related: [{ label: "Candidates", href: "/hiring/candidates" }],
  },

  "/hiring/candidates": {
    summary: "Everyone in the pipeline, by requisition and stage.",
    tasks: [
      {
        title: "Add a candidate",
        steps: ["Press Add candidate, choose the requisition, and enter their details and resume."],
      },
      {
        title: "Move a candidate between stages",
        steps: [
          "Use the Board, or Move on a candidate.",
          "Choose the stage; tick Tell the candidate to email them.",
        ],
      },
    ],
    tips: ["A move to Offer or Hired happens from the offer, never by hand."],
  },

  "/hiring/candidates/[id]": {
    summary: "One candidate: applications, interviews, scores, consent, documents, messages, offers and checks.",
    tasks: [
      {
        title: "Schedule an interview or record feedback",
        steps: ["Open Interviews to schedule a round, or open a round to record outcomes."],
      },
      {
        title: "Email the candidate or share their portal link",
        steps: ["Use Email the candidate, or Candidate portal link to let them see their status."],
      },
      {
        title: "Request a background check",
        steps: ["Open Background check and press Request a background check."],
      },
    ],
    tips: ["Scores appear only with the evidence and signals behind them."],
  },

  "/hiring/interviews": {
    summary: "Interview panels, times, replies and feedback.",
    tasks: [
      {
        title: "Give interview feedback",
        steps: ["Open My panels, open the interview and submit your scorecard."],
      },
      {
        title: "Schedule interviews",
        steps: [
          "Open Schedule, choose the requisition, candidate, round and panel; Find times suggests free slots; then press Schedule.",
          "Or send a Self-scheduling link so the candidate picks a slot.",
        ],
      },
      {
        title: "Set up rounds",
        roles: [...HR],
        steps: ["Open Rounds to define each round, whether it eliminates, and whether feedback is required."],
      },
    ],
    tips: [
      "Consolidated shows every panelist's feedback side by side.",
      "Connect links your calendar so free times and invites use it.",
    ],
  },

  "/hiring/offers": {
    summary: "Draft, approve, release and close offers. Every approver sees the budget deviation first.",
    tasks: [
      {
        title: "Make an offer",
        steps: [
          "Press Draft offer for the candidate, with CTC, joining date and validity.",
          "Submit it for approval, then release it to the candidate.",
        ],
      },
    ],
    tips: [
      "An accepted offer converts the candidate into a new joiner and can start onboarding.",
      "Lapse overdue offers closes offers past their validity.",
    ],
  },

  "/hiring/talent-pools": {
    summary: "Candidates worth a call when the right role opens. Only those who agreed to be kept can be added.",
    tasks: [
      {
        title: "Create a pool and add people",
        steps: ["Press New pool, name it, then add candidates who agreed to be kept."],
      },
    ],
  },

  "/hiring/referrals": {
    summary: "Refer someone for an open role, in your name, or share a link that carries it.",
    tasks: [
      {
        title: "Refer a friend",
        steps: [
          "Open Open roles and press Refer someone on a role.",
          "Enter their details and resume, or use Share to send them a referral link.",
        ],
      },
      {
        title: "Run the referral programme",
        roles: [...HR],
        steps: [
          "Open Programmes and press New programme with the bonus by grade and when it is paid.",
          "In All referrals, press Mark hired, and later Mark paid.",
        ],
      },
    ],
  },

  "/hiring/analytics": {
    summary: "Where candidates drop out, how long each step takes, and what each source and hire costs.",
    tasks: [
      {
        title: "Record hiring costs",
        steps: ["Press Record cost and enter the amount, source and period."],
      },
    ],
    tips: ["Every figure is worked out from the hiring records; empty sections say so."],
  },

  "/hiring/job-boards": {
    summary: "Post open requisitions to external job boards and see where each posting stands.",
    tasks: [
      {
        title: "Post a requisition",
        steps: ["Press Add account to connect a board, then Post a requisition."],
      },
    ],
  },

  "/hiring/careers-site": {
    summary: "The public page where candidates see your open roles and apply.",
    tasks: [
      {
        title: "Set up the careers page",
        steps: ["Fill in the page's headline, description and branding, and press Save."],
      },
    ],
    tips: ["Open roles appear on the page automatically once their requisition is approved and open."],
  },
};

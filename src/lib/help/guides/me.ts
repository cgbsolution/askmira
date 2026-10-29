import type { PageGuide } from "../index";

const HR = ["admin", "sub_admin"] as const;
const MANAGERS = ["admin", "sub_admin", "manager"] as const;

/**
 * Guides for the "Me" pages: what every employee uses day to day.
 * Button and tab names are the ones on the page; keep them in step.
 */
export const ME_GUIDES: Record<string, PageGuide> = {
  "/": {
    summary:
      "Your home page: today's punch, what is waiting on you, your leave, announcements and shoutouts, in one place.",
    tasks: [
      {
        title: "Punch in or out",
        steps: [
          "Press Punch in when you start work, and Punch out when you finish.",
          "If your company uses a geofence, allow location access when the browser asks.",
          "The card confirms the time and the office it recorded.",
        ],
      },
      {
        title: "See what is waiting on you",
        steps: ["Look at the approvals card, or open Approvals in the menu, to decide each request."],
      },
      {
        title: "Change your quick links",
        steps: [
          "Press Edit quick links on the Quick links card.",
          "Tick the pages you use most and press Save. Reset to defaults puts back the standard set.",
        ],
      },
    ],
    tips: [
      "Every number on Home comes from your own records; a card with nothing to show says so.",
      "Press Ctrl K (⌘K on a Mac) to search for a colleague from anywhere.",
    ],
    related: [
      { label: "Approvals", href: "/approvals" },
      { label: "Time off", href: "/time" },
      { label: "Attendance", href: "/time/attendance" },
    ],
  },

  "/ask-mira": {
    summary:
      "Mira is your company's AI companion. Ask in plain words; it looks things up with your own access and shows the result under its reply.",
    tasks: [
      {
        title: "Ask a question",
        steps: [
          "Type your question in the box at the bottom, or press one of the suggestions.",
          "Press Enter or Send. Shift+Enter starts a new line.",
          "Read Mira's reply and the cards under it: the cards are the actual records, and the small labels above the reply show what Mira looked up.",
          "Carry on in the same conversation: Mira remembers what was said and found earlier, so “and for last year?” works.",
        ],
      },
      {
        title: "Get something done (leave, attendance, approvals, HR tickets)",
        steps: [
          "Say what you want, for example “I want to take leave on 5 November”.",
          "Mira checks it first — the leave type, your balance, holidays and who approves it — and shows an offer card with what it will send.",
          "Nothing is sent until you press the button on the offer (Send for approval, Approve…) or reply “yes”. Press Cancel or say no to drop it.",
          "Once confirmed it goes through the normal process: a leave request still waits for your approver.",
        ],
      },
      {
        title: "Ask for a trend or a P&L",
        roles: ["admin", "sub_admin"],
        steps: [
          "Ask “payroll cost trend for the last 6 months”, “why did payroll go up in September”, or “P&L for <account> this year”.",
          "Mira shows the chart and the table, worked out from the payslips and the account's billing and people mapping.",
        ],
      },
      {
        title: "Start, reopen or delete a conversation",
        steps: [
          "Press New conversation to start fresh.",
          "Pick an earlier conversation on the left to carry on with it.",
          "Press the bin icon next to a conversation to delete it.",
        ],
      },
      {
        title: "Switch Mira on for the company",
        roles: ["admin"],
        steps: [
          "Go to Settings → Company and open the AI tab.",
          "Turn on “AI features for this workspace” and “Ask Mira chat”, then press Save.",
          "In the Ask Mira part of that tab, choose its name, greeting, tools and limits.",
        ],
      },
    ],
    tips: [
      "Mira works without AI too: it then matches your words to a lookup, so ask short, direct questions like “Who is on leave this week?” or “My pending expense claims”. Nothing you type leaves AskMira.",
      "For free-form questions and policy answers, AI must be on for your workspace and you must agree to “AI assistant” under My privacy in your account menu; nothing is sent to the AI provider until you do.",
      "Mira can tell you your leave balance, latest payslip, attendance and manager; who is on leave; find colleagues; list departments and offices; and answer policy questions from what HR published.",
      "Where your company uses the separate interview or expense tool, Mira can also show the jobs, candidates, interviews and expense claims you may see there.",
      "Mira reads what it looks up only where your company's data-protection register lets the AI provider receive that kind of record, and never contact details, ID numbers, bank details or leave reasons. Otherwise it only knows the result is on your screen. It never states a fact it did not look up.",
      "An offer expires after two hours; ask again and Mira checks the figures afresh.",
      "There is a daily message limit per person; the line under the box shows what is left.",
    ],
    related: [
      { label: "My privacy", href: "/compliance/privacy" },
      { label: "Ask HR", href: "/assistant" },
    ],
  },

  "/approvals": {
    summary:
      "Everything waiting on your decision, oldest first: leave, attendance corrections, expenses, requisitions, documents and more.",
    tasks: [
      {
        title: "Decide a request",
        steps: [
          "Press a kind (for example Time off or Expense claims) to narrow the list, or All.",
          "Open a request to see its full context on its own page.",
          "Approve it, or reject it with a reason the requester will see.",
        ],
      },
      {
        title: "Hand over your approvals while you are away",
        steps: [
          "Under hand-over, choose a colleague and pick the date you are back.",
          "Press Hand over. Your approvals go to them until that date; press End to stop early.",
        ],
      },
    ],
    tips: [
      "A request reaches you because an approval rule names you: as a manager, an HR approver, or someone chosen for that kind of request.",
      "When nothing is waiting, the page says “Nothing is waiting on you”.",
    ],
    related: [
      { label: "Time off", href: "/time" },
      { label: "Attendance review", href: "/time/attendance-review" },
    ],
  },

  "/approvals/lifecycle/[id]": {
    summary:
      "One change to somebody's employment (a promotion, transfer, confirmation or similar), waiting on your approval.",
    tasks: [
      {
        title: "Approve or reject the change",
        steps: [
          "Read what changes, from when, and why.",
          "Check any salary revision and the letter that will be issued.",
          "Approve to pass it to the next approver, or reject with a reason.",
        ],
      },
    ],
    tips: ["An approved change is applied on its effective date, not before."],
    related: [{ label: "Approvals", href: "/approvals" }],
  },

  "/onboarding": {
    summary: "Everything to get ready before you join and to settle in during your first weeks.",
    tasks: [
      {
        title: "Finish your joining tasks",
        steps: [
          "Work down the checklist: each task says what is needed and by when.",
          "Open a task to fill in the form, upload the document or accept the policy it asks for.",
          "A finished task is ticked, and HR sees your progress.",
        ],
      },
    ],
    tips: [
      "Your buddy and manager are named on the page; ask them anything.",
      "Documents you upload here go to your employee record and are verified by HR.",
    ],
    related: [{ label: "My documents", href: "/docs" }],
  },

  "/onboarding/tasks": {
    summary:
      "Onboarding work that is yours for new joiners: as their manager, buddy, or the IT, HR or finance owner.",
    tasks: [
      {
        title: "Complete a task for a new joiner",
        steps: [
          "Find the task by the joiner's name and due date.",
          "Do the work (set up a laptop, meet them, and so on) and press Mark done.",
          "Tick Show completed to see what you already finished.",
        ],
      },
    ],
    tips: ["Overdue tasks are reminded every morning, to you and to HR."],
  },

  "/time": {
    summary: "Your leave balances and requests, the ones you approve, holidays, and who is out when.",
    tasks: [
      {
        title: "Apply for leave",
        steps: [
          "Press Request time off.",
          "Choose the leave type: each shows the days you have. Leave is applied only against a balance, so a type with none cannot be picked, and with no balance at all you cannot apply.",
          "Choose the From and To dates; switch on Half day for half a day.",
          "Add a note for the approver, and a supporting document if the leave type needs one.",
          "Check the line that says what it costs and who it goes to, then press Submit request.",
        ],
      },
      {
        title: "Cancel a request",
        steps: ["In the Requests tab, press Cancel on the request, then confirm. Keep it leaves it as it is."],
      },
      {
        title: "Claim compensatory off",
        steps: [
          "Open the Comp-off tab and press Claim comp-off.",
          "Give the day you worked, a full or half day, and why, then send it.",
        ],
      },
      {
        title: "Take an optional holiday",
        steps: ["Open the Holidays tab and press Take it on the optional holiday you want."],
      },
      {
        title: "Approve or decline your team's leave",
        roles: [...MANAGERS],
        steps: [
          "Open the Approvals tab: each request shows the person's balance and what approving leaves.",
          "Press Approve, or Decline with a reason the person will see. A request the balance no longer covers cannot be approved.",
        ],
      },
      {
        title: "Set up leave types, policies and holidays",
        roles: [...HR],
        steps: [
          "Open the Setup tab.",
          "Add or edit leave types (paid or not, half days, sandwich rule). Every type, unpaid included, is applied only against a balance: give days through a policy or Adjust balance.",
          "Add policies (who gets how much, and how it accrues) and the holiday calendar.",
        ],
      },
      {
        title: "Adjust someone's balance",
        roles: [...HR],
        steps: [
          "Open the Balances tab and choose the person.",
          "Press Adjust, enter the days to add or remove and why; it is kept in the audit trail.",
        ],
      },
    ],
    tips: [
      "Some leave types need notice; the line at the bottom of the form tells you before you submit.",
      "Weekends and holidays inside your dates are not counted, unless the policy applies the sandwich rule.",
      "Who's out shows approved leave only, never the reason.",
    ],
    related: [
      { label: "Attendance", href: "/time/attendance" },
      { label: "Approvals", href: "/approvals" },
    ],
  },

  "/time/attendance": {
    summary: "Your punches, your attendance for each day, corrections and shift swaps.",
    tasks: [
      {
        title: "Correct a day (missed punch, on duty, work from home)",
        steps: [
          "Press Missed punch, On duty or Work from home, whichever applies.",
          "Choose the day, give the times and a reason, and send it.",
          "Your manager approves it; until then the day shows the request.",
        ],
      },
      {
        title: "Ask for a shift swap",
        steps: [
          "Open the List tab and press Ask for a swap on the day.",
          "Choose the colleague to swap with and send it; they and your manager approve it.",
        ],
      },
      {
        title: "Withdraw a request",
        steps: ["Find the request and press Withdraw, then confirm."],
      },
    ],
    tips: [
      "The Calendar shows each day's in and out times; use the arrows to change month, or Today to come back.",
      "Late arrivals and half days are worked out from your shift's rules.",
    ],
    related: [{ label: "Attendance review", href: "/time/attendance-review" }],
  },

  "/time/attendance-review": {
    summary: "For managers and HR: who is in today, attendance requests to decide, swaps, coverage and exceptions.",
    tasks: [
      {
        title: "Check who is in today",
        steps: ["Open Team today; press a count (In, Not in yet, Late, On leave, Remote) to see who. Refresh reloads it."],
      },
      {
        title: "Decide correction requests",
        steps: ["Open the Requests tab and press Approve, or Reject with a reason."],
      },
      {
        title: "Resolve exceptions",
        steps: ["Open the Exceptions tab, filter by kind, and fix or approve each one."],
      },
    ],
    tips: ["Coverage shows whether each location and team has the people its shifts need."],
  },

  "/time/overtime": {
    summary:
      "Overtime from attendance, decided by the line manager or HR, priced by the location's policy and paid in the next payroll run.",
    tasks: [
      {
        title: "See your overtime",
        steps: ["Open the My overtime tab: each day, how long, the decision and the run that paid it."],
      },
      {
        title: "Approve overtime",
        roles: [...MANAGERS],
        steps: [
          "Open the Review tab; Awaiting approval shows what needs a decision.",
          "Select the days and approve or reject them.",
        ],
      },
      {
        title: "Bring in overtime and set the policy",
        roles: [...HR],
        steps: [
          "Press Sync from attendance to work out overtime from the latest punches.",
          "In the Policy tab, press New policy to set rates, whether weekly offs and holidays count, and whether each day needs approval.",
        ],
      },
    ],
    tips: ["Only approved overtime reaches payroll."],
  },

  "/time/timesheets": {
    summary: "Your hours against projects, a week at a time. Your manager approves the week.",
    tasks: [
      {
        title: "Fill in and submit your week",
        steps: [
          "Use the arrows to move to the week you want.",
          "Press Add a line for each project (and task), and enter hours for each day.",
          "Press Save draft to keep it, or Submit week when it is complete.",
        ],
      },
    ],
    tips: [
      "A week sent back by your manager opens again for editing.",
      "Once approved, a week cannot be changed.",
    ],
    related: [{ label: "Timesheet approvals", href: "/time/timesheets/approvals" }],
  },

  "/time/timesheets/approvals": {
    summary: "Weeks an approval rule has put in front of you, hours by project, and the project list.",
    tasks: [
      {
        title: "Approve or send back a week",
        steps: ["Open To approve and press Approve, or Send back with a note saying what to fix."],
      },
      {
        title: "Add a project or task",
        steps: ["Open the Projects tab and press New project (or add a task to one); mark it Billable if it is billed."],
      },
    ],
    tips: ["Hours by project shows approved hours for any date range."],
  },

  "/time/shifts": {
    summary: "Shift definitions, rosters, assignments, the payroll lock on attendance, punch imports and work locations.",
    tasks: [
      {
        title: "Define a shift",
        steps: ["In the Shifts tab press New shift: start, end, breaks, grace and half-day rules. Make default sets the usual one."],
      },
      {
        title: "Assign shifts and rosters",
        steps: [
          "Create rotations in Rosters with New roster.",
          "In Assignments, choose an employee and assign a shift or roster for a date range; End stops one.",
        ],
      },
      {
        title: "Lock attendance for payroll",
        steps: [
          "Open Periods & payroll lock and pick the month.",
          "Press Recompute if punches changed, then Lock for payroll. Unlock only to correct it.",
        ],
      },
      {
        title: "Import punches or add a work location",
        steps: [
          "In Import punches, press Upload and import with a device's punch file.",
          "In Work locations, press Add location to set an office and its geofence.",
        ],
      },
    ],
    tips: ["Payroll reads attendance only from locked periods."],
  },

  "/pay": {
    summary: "Your payslips and salary history.",
    tasks: [
      {
        title: "Open or download a payslip",
        steps: ["Open a month to read each line and how it was worked out, or press PDF to download it."],
      },
    ],
    tips: [
      "A payslip appears once the month's payroll is approved and published.",
      "A question about a line? Raise a helpdesk ticket under Payroll.",
    ],
    related: [
      { label: "Tax declarations", href: "/pay/tax" },
      { label: "Helpdesk", href: "/helpdesk" },
    ],
  },

  "/pay/payslips/[id]": {
    summary: "Every line on your payslip, and how it was worked out.",
    tasks: [
      {
        title: "Understand a line",
        steps: ["Find the line under earnings or deductions and read how it was calculated; the tax working is at the bottom."],
      },
    ],
    related: [{ label: "All payslips", href: "/pay" }],
  },

  "/pay/tax": {
    summary: "Your tax regime, investment declarations, rent, previous employer income, Form 12BB and Form 16.",
    tasks: [
      {
        title: "Choose your tax regime",
        steps: ["Pick the financial year at the top, open the Regime tab, compare old and new, and choose."],
      },
      {
        title: "Declare investments",
        steps: [
          "Open Declarations and press Add declaration.",
          "Choose the section (80C, 80D and others) and the amount; Edit changes one later.",
          "When the proof window opens, press Proof to upload the document.",
        ],
      },
      {
        title: "Declare rent and previous employer income",
        steps: [
          "In House rent, enter the rent for each month (Fill all twelve months copies one value) and press Save rent.",
          "In Previous employer, enter this year's earlier salary and tax and press Save figures.",
        ],
      },
      {
        title: "Get your forms",
        steps: ["Download Form 12BB and, after the year, Form 16 from their tabs."],
      },
    ],
    tips: [
      "Projection shows your expected tax for the year from what you declared.",
      "Declarations change your monthly TDS from the next payroll run.",
    ],
  },

  "/pay/loans": {
    summary: "Your loans and repayments, leave encashment and pay you have already earned.",
    tasks: [
      {
        title: "Apply for a loan",
        steps: ["In My loans, press Apply for a loan, choose the scheme, amount and months, and submit it."],
      },
      {
        title: "Request leave encashment",
        steps: ["Open Leave encashment, press Request encashment, choose the leave and days, and submit."],
      },
      {
        title: "Draw pay you have already earned",
        steps: [
          "Where your company allows it, the “Pay you have already earned” card shows what you can draw.",
          "Enter an amount and ask; it is recovered from this month's pay.",
        ],
      },
    ],
    tips: [
      "Loan repayments are deducted in payroll on the schedule shown under My loans.",
      "Salary reimbursements (fuel, phone and the like) are under Expenses → Salary reimbursements.",
    ],
  },

  "/expenses/reimbursements": {
    summary:
      "Reimbursement components of your salary — fuel, phone and the like: what each allows this year, what you have claimed, and new claims against bills.",
    tasks: [
      {
        title: "Claim a reimbursement",
        steps: [
          "Pick the financial year, then press New claim.",
          "Choose the component (for example fuel or phone), enter the amount, attach bills, and submit it to HR.",
        ],
      },
    ],
    tips: [
      "What HR accepts is paid with your salary in the next payroll run.",
      "These come from your salary structure; other business expenses are claimed under Expenses.",
    ],
    related: [{ label: "Loans & encashment", href: "/pay/loans" }],
  },

  "/linked/[product]/[view]": {
    summary:
      "Records from a product your company uses alongside AskMira — ExpenseGenie for expenses, AnytimeHire for hiring, CGB Helpdesk for IT tickets and assets — read live, as you see them there.",
    tasks: [
      {
        title: "Narrow the list",
        steps: [
          "Choose a status, pick dates, or type in Search and press Search.",
          "Press Refresh to read it again from the product.",
        ],
      },
      {
        title: "Raise an IT ticket",
        steps: [
          "On Helpdesk → My tickets, press Raise a ticket.",
          "Choose the category and priority, pick the device if it is about one you hold, write a subject and what happens, then press Raise ticket.",
          "The ticket opens: replies from the IT team show there, and you can answer them.",
        ],
      },
      {
        title: "Do the work in the product",
        steps: [
          "Press Open ExpenseGenie, Open AnytimeHire or Open CGB Helpdesk at the top; you are signed in there with your AskMira login.",
          "On a hiring row, press Open to go straight to that job's candidates and their résumés.",
          "On a ticket row, press View to read the ticket and reply.",
        ],
      },
    ],
    tips: [
      "Nothing is copied into AskMira: each page asks the product as you, so you see exactly what your role there allows.",
      "Ask Mira can answer the same questions in chat.",
    ],
    related: [{ label: "Ask Mira", href: "/ask-mira" }],
  },

  "/linked/[product]/[view]/[id]": {
    summary:
      "One CGB Helpdesk ticket: what was asked, the conversation with the IT team, and where it stands — read live from the helpdesk.",
    tasks: [
      {
        title: "Reply to the IT team",
        steps: ["Write in Reply and press Send.", "The IT team sees it in CGB Helpdesk and by email."],
      },
      {
        title: "Add a file, reopen it or work it",
        steps: [
          "Press Open in CGB Helpdesk; you are signed in there with your AskMira login.",
          "Attach files, reopen a closed ticket, or — for the IT team — pick it up, put it on hold or close it there.",
        ],
      },
    ],
    tips: [
      "Press Refresh to see new replies.",
      "A closed ticket takes no more replies until it is reopened in CGB Helpdesk.",
    ],
    related: [{ label: "My tickets", href: "/linked/helpdesk/tickets" }],
  },

  "/pay/benefits": {
    summary: "Your group insurance plans, who they cover, and changes after a life event.",
    tasks: [
      {
        title: "Enrol in a plan",
        steps: ["Find the plan and enrol: add the dependants to cover and any top-up, then confirm."],
      },
      {
        title: "Change cover after a life event",
        steps: [
          "Press “Marriage, birth or other change”.",
          "Say what happened and when, add or remove dependants, and submit it; HR approves it.",
        ],
      },
    ],
    tips: ["Waive this plan if you do not want the cover; you can join at the next window."],
  },

  "/pay/stock-options": {
    summary: "Your stock option grants, how they vest, and what they are worth at today's fair value.",
    tasks: [
      {
        title: "Read your grants",
        steps: ["Each grant shows its units, vesting schedule, what has vested and its value; the what-if shows another price."],
      },
    ],
    tips: ["Exercises are recorded by HR; values use the latest fair value HR entered."],
  },

  "/expenses": {
    summary: "Record expenses, see what the policy says about each one, and submit them for approval.",
    tasks: [
      {
        title: "Add an expense claim",
        steps: [
          "Press New claim.",
          "Choose the type of claim, where it was spent (city tier) and the category, then the amount, currency and date.",
          "Attach the bill (image or PDF) and add a description.",
          "Press Check policy and save. Read what the policy says, then submit it, or keep it as a draft.",
        ],
      },
      {
        title: "Group claims into a report",
        steps: ["Open the Reports tab and press New report, then add the claims (for example, one trip's) and submit them together."],
      },
    ],
    tips: [
      "A claim over the limit needs a justification; a category that needs pre-approval needs an approved travel request first.",
      "Your manager approves first, then finance.",
    ],
    related: [
      { label: "Travel & advances", href: "/expenses/travel" },
      { label: "Team approvals", href: "/expenses/team" },
    ],
  },

  "/expenses/travel": {
    summary: "Ask for a trip to be approved, see advances you hold, and what is left to account for.",
    tasks: [
      {
        title: "Request a trip",
        steps: ["Press New travel request, give the purpose, from and to dates, estimated cost and any advance, then submit."],
      },
    ],
    tips: ["An advance you take is settled against the claims you file for that trip."],
  },

  "/expenses/team": {
    summary: "Expense claims and travel requests from your team, before finance sees them.",
    tasks: [
      {
        title: "Approve or reject a claim or trip",
        steps: [
          "Open the Claims tab (or Travel requests).",
          "Press Receipt to see the bill, then Approve, or Reject with a reason.",
        ],
      },
    ],
    tips: ["Approved claims go on to finance review."],
  },

  "/expenses/review": {
    summary: "Claims, trips and advances waiting on finance, and how long they have waited.",
    tasks: [
      {
        title: "Review claims",
        steps: ["Open the Claims tab, press Receipt to check the bill, then Approve or Reject with a reason."],
      },
      {
        title: "Settle advances",
        steps: ["Open Advances to settle and press Settle, with the date it was settled."],
      },
    ],
    tips: ["Ageing shows how long claims have waited at each stage."],
  },

  "/expenses/policies": {
    summary: "Expense policy rules, city tiers, mileage, per-diem, exchange rates and settings.",
    tasks: [
      {
        title: "Change a policy",
        steps: ["In Policies, press New policy, or New version on an existing one; Deactivate retires it."],
      },
      {
        title: "Set rates",
        steps: [
          "City tiers: press Change on a city.",
          "Mileage and Per-diem: press Add rate. Exchange rates: press Enter rate.",
          "Settings: choose which date's rate applies and press Save settings.",
        ],
      },
    ],
    tips: ["Rates apply from their “In force from” date; a claim uses the rate in force when it was spent."],
  },

  "/expenses/gst": {
    summary: "Input tax credit on expenses: eligibility, the register and GSTR-2B reconciliation.",
    tasks: [
      {
        title: "Capture a GST invoice",
        steps: ["Open Capture, enter the vendor GSTIN, HSN/SAC, invoice number, date and amounts, press Check, then Capture."],
      },
      {
        title: "Review credits",
        steps: ["Work through the Review queue, opening each invoice to accept or reject its credit."],
      },
      {
        title: "Reconcile with GSTR-2B",
        steps: ["Open GSTR-2B, press Import for the month's file, then Reconcile and resolve each mismatch."],
      },
    ],
    tips: [
      "Register lists every credit; Load register and CSV take it away.",
      "“What is enforced and what is not built” explains exactly what this page checks.",
    ],
  },

  "/assistant": {
    summary: "Policy questions answered from what your HR team published, with the source of every line.",
    tasks: [
      {
        title: "Ask a policy question",
        steps: ["In the Ask tab, type your question and send it; press a source to read the policy it came from."],
      },
      {
        title: "Publish a policy for the assistant",
        roles: [...HR],
        steps: [
          "Open the Policies tab and press New policy.",
          "Write it and mark it Published, so the assistant may answer from it.",
          "Check What people ask for questions it could not answer.",
        ],
      },
    ],
    tips: ["The assistant answers only from published policies; when they do not cover a question, it says so."],
    related: [{ label: "Ask Mira", href: "/ask-mira" }],
  },

  "/learning": {
    summary: "Courses you have been asked to complete, and your certificates.",
    tasks: [
      {
        title: "Complete a course",
        steps: [
          "Open the course from the list.",
          "Go through its modules, answer the quiz if there is one, and tick “I have read and understood this course”.",
        ],
      },
      {
        title: "Download a certificate",
        steps: ["Find a completed course and download its certificate."],
      },
    ],
    tips: ["Each course shows its due date; overdue courses are reminded."],
  },

  "/learning/admin": {
    summary: "Create courses and assign them to people.",
    tasks: [
      {
        title: "Create a course",
        steps: ["Press New course, add its modules and, if needed, a quiz, then save."],
      },
      {
        title: "Assign a course",
        steps: ["Press Assign on a course, choose the people and a due date, and confirm."],
      },
    ],
    tips: ["Completion and certificates are tracked per person."],
  },

  "/docs": {
    summary: "ID proofs, contracts and letters, kept with each employee record, and company documents.",
    tasks: [
      {
        title: "Add one of your documents",
        steps: [
          "Press Add a document, choose its category and file, and add any expiry date.",
          "HR verifies it; its status shows in the list.",
        ],
      },
      {
        title: "Read company documents",
        steps: ["Open Company documents and press Download on a policy or handbook."],
      },
      {
        title: "Verify documents",
        roles: [...HR],
        steps: [
          "Open the To verify tab and use a document's actions to verify or reject it with a reason.",
          "Check the Expiring tab for documents that need renewing.",
          "Upload adds a document to anyone's record; Add company document adds a policy for everyone.",
        ],
      },
    ],
    tips: ["Tick “Show earlier versions” to see documents that were replaced."],
    related: [{ label: "Letters", href: "/docs/letters" }],
  },

  "/docs/letters": {
    summary: "Letters issued to employees: offers, appointments, confirmations, salary certificates and more.",
    tasks: [
      {
        title: "Issue a letter",
        steps: [
          "Press Issue letter, choose the person and the template.",
          "Fill in any values it asks for and preview it, then issue it. If it needs approval, the approver sees it first.",
          "Use the letter's actions to request acknowledgement or download it.",
        ],
      },
    ],
    tips: ["Issued letters are kept as PDFs on the person's record."],
    related: [{ label: "Templates", href: "/docs/templates" }],
  },

  "/docs/templates": {
    summary: "Letter templates, their versions, and the values each one fills in.",
    tasks: [
      {
        title: "Create or update a template",
        steps: [
          "Press New template, or use a template's actions to edit it.",
          "Write the letter with placeholders for values like name and CTC, and save it as a new version.",
        ],
      },
      {
        title: "Start from the standard set",
        steps: ["Press Install seed templates to add standard Indian letters and statutory forms."],
      },
    ],
    tips: ["Earlier letters keep the version they were issued with. Review templates with HR and legal before use."],
  },

  "/assets": {
    summary: "The company equipment you hold, and the things you have asked for.",
    tasks: [
      {
        title: "Request an asset",
        steps: [
          "Press Request an asset.",
          "Choose what you need, say why and by when, and press Send request.",
        ],
      },
      {
        title: "Confirm you received an asset",
        steps: ["Press Acknowledge on the asset you were handed."],
      },
    ],
    tips: ["Withdraw a request you no longer need."],
  },

  "/assets/inventory": {
    summary: "Every tagged asset, who holds it, and what it is worth today.",
    tasks: [
      {
        title: "Add an asset",
        steps: ["Press Add asset: category, tag, serial number, purchase date and cost; assign it or keep it in stock."],
      },
      {
        title: "Find or export assets",
        steps: ["Filter by status, category or location; Export CSV takes the list away."],
      },
    ],
    tips: ["Set up asset categories first; depreciation follows the category."],
    related: [{ label: "Categories", href: "/assets/categories" }],
  },

  "/assets/requests": {
    summary: "Asset requests to decide and to hand over.",
    tasks: [
      {
        title: "Decide a request",
        steps: ["Open To decide and press Approve or Reject."],
      },
      {
        title: "Hand over an approved request",
        roles: [...HR],
        steps: ["Open To hand over, press Hand over, and pick the asset from stock."],
      },
    ],
  },

  "/assets/categories": {
    summary: "What the company tracks, how long each kind takes to depreciate, and who collects it when somebody leaves.",
    tasks: [
      {
        title: "Add or change a category",
        steps: [
          "Press Add category (or Edit on one).",
          "Set the depreciation period and who collects it at exit; tick “Holder acknowledges receipt” if people must confirm.",
        ],
      },
    ],
  },

  "/helpdesk": {
    summary: "Ask HR for a letter, a salary answer, an ID card or anything else, and follow the conversation in one place.",
    tasks: [
      {
        title: "Raise a ticket",
        steps: [
          "Press Raise a ticket.",
          "Choose a category and priority, write a subject and description, attach a file if useful, and press Raise ticket.",
          "The ticket opens: replies appear there, and you are notified too.",
        ],
      },
      {
        title: "Reply, reopen or rate a ticket",
        steps: [
          "Open the ticket and use Send reply to add details.",
          "Once resolved, rate it, or reopen it and say what is still wrong.",
        ],
      },
    ],
    tips: [
      "The tabs show Open, Resolved, Closed and All tickets.",
      "Each category has a target time; the ticket shows when to expect an answer.",
    ],
  },

  "/helpdesk/queue": {
    summary: "Every active ticket for HR, earliest deadline first.",
    tasks: [
      {
        title: "Work a ticket",
        steps: [
          "Filter by status, category, assignee, priority or Overdue only.",
          "Open a ticket to reply, change its status or assign it, and resolve it when done.",
        ],
      },
      {
        title: "Raise a ticket for someone",
        steps: ["Press Raise on behalf and choose the person."],
      },
    ],
    tips: ["A confidential grievance is seen only by the people its category allows."],
  },

  "/helpdesk/assigned": {
    summary: "Tickets in the helpdesk categories you own, and any assigned to you.",
    tasks: [
      {
        title: "Work your tickets",
        steps: ["Open a ticket, reply to the employee, update its status, and resolve it when done."],
      },
    ],
    tips: ["HR makes you a category owner on the Categories page; until then there is no queue for you."],
    related: [{ label: "My tickets", href: "/helpdesk" }],
  },

  "/helpdesk/categories": {
    summary: "What employees can raise tickets about, who handles each kind and how fast.",
    tasks: [
      {
        title: "Add or change a category",
        steps: [
          "Press New category (or Edit on one): name, owner, and response and resolution targets.",
          "Add the standard categories sets up the usual eight at once. Switch off retires one.",
        ],
      },
    ],
  },

  "/notifications": {
    summary: "What has been sent to you, and how you want to be told.",
    tasks: [
      {
        title: "Read and clear notifications",
        steps: ["Open the Inbox; tick Unread only to see what is new; press Mark read, or Mark all read."],
      },
      {
        title: "Choose how you are told",
        steps: ["Open Preferences, choose in-app, email, push or WhatsApp for each kind of message, and press Save preferences."],
      },
    ],
  },

  "/profile": {
    summary: "Your own record (personal details, family, education, bank and statutory details, employment) and your sign-in.",
    tasks: [
      {
        title: "Update your contact details or photo",
        steps: ["Press Edit contact details, or Add photo, and save."],
      },
      {
        title: "Change personal, bank or nominee details",
        steps: [
          "Open the tab (Personal, Family & nominees, Education & experience, Statutory & bank).",
          "Press Edit for details you may change yourself, or Request change for those HR must approve (bank, IDs, legal name, address, nominees).",
        ],
      },
      {
        title: "Turn on two-step sign-in",
        steps: ["In Overview, set up two-step sign-in with an authenticator app, save the recovery codes and confirm “I have saved them”."],
      },
      {
        title: "Resign",
        steps: ["Open the Resignation tab and submit your resignation with your proposed last day."],
      },
    ],
    tips: ["Change requests shows what you asked HR to change and where it stands."],
  },
};

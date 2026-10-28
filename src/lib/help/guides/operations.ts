import type { PageGuide } from "../index";

/** Guides for Operations and Admin: payroll, reports, compliance, platform, settings. */
export const OPERATIONS_GUIDES: Record<string, PageGuide> = {
  "/payroll": {
    summary:
      "Compute, check, approve & lock, then publish a month's pay. Nothing is locked without a second person's sign-off.",
    tasks: [
      {
        title: "Run payroll for a month",
        steps: [
          "Make sure attendance for the month is locked (Attendance → Shifts & rosters → Periods & payroll lock → Lock for payroll).",
          "Press New run, choose the month and legal entity, and open it.",
          "Press Compute. If something is missing (a salary, a rule set, the attendance lock) it says what; fix it and compute again.",
          "Check the payslips and the variances against last month. Download → Salary register (Excel) gives every person's earnings, deductions and net pay.",
          "Acknowledge each variance you accept. A second admin presses Approve & lock; then publish payslips to employees.",
        ],
      },
      {
        title: "Delete a run",
        steps: [
          "Open the ⋯ menu on the run's row (or open the run) and choose Delete run.",
          "Only a run that is not locked can be deleted: Draft, Computed · not locked, Failed or Cancelled. Its payslips go with it and the month can be run again.",
        ],
      },
      {
        title: "Download a month's payroll data",
        steps: [
          "Open the ⋯ menu on the run's row, or the Download button on the run.",
          "Salary register (Excel) has one row per person with every wage type, deduction, net pay and employer cost; a second sheet lists claims, overtime, adjustments and recoveries.",
        ],
      },
    ],
    tips: [
      "Approve & lock is the lock: a locked run cannot be recomputed or deleted. A correction after that is an arrears or off-cycle run.",
      "The person who computes a run cannot also approve and lock it.",
      "Statutory rates come from the approved rule set in force on the run's date.",
    ],
    related: [
      { label: "Salary master", href: "/payroll/salaries" },
      { label: "Adjustments", href: "/payroll/adjustments" },
      { label: "Bank files", href: "/payroll/disbursements" },
    ],
  },

  "/payroll/runs/[id]": {
    summary: "One payroll run: its status, payslips, totals and variances against the previous month.",
    tasks: [
      {
        title: "Check and lock the run",
        steps: [
          "Check totals and open payslips that look unusual. Download → Salary register (Excel) gives the whole month in one sheet.",
          "Acknowledge each variance with a note on why it is right. Recompute after any change to salaries, attendance or inputs.",
          "When it is right, someone other than whoever computed it presses Approve & lock.",
        ],
      },
      {
        title: "Start the month again",
        steps: ["While the run is not locked, press Delete run. Its payslips go with it; open a new run for the month."],
      },
    ],
    tips: [
      "A locked run cannot be recomputed or deleted; a correction is an arrears or off-cycle run.",
      "After locking, prepare the salary file under Bank files and the returns under Return filings.",
    ],
  },

  "/payroll/runs/[id]/payslips/[payslipId]": {
    summary: "One payslip in a run: every line, the rule version behind it, and the income tax working.",
    tasks: [
      {
        title: "Check a payslip",
        steps: ["Read each line and the rule version it used; check the tax working at the bottom."],
      },
    ],
  },

  "/payroll/salaries": {
    summary:
      "One person's salary revisions, newest first. Add a revision, type the amount of any wage type, or correct a revision payroll has not paid yet.",
    tasks: [
      {
        title: "Find a person's salary",
        steps: [
          "Type a name or employee code in the search box; the dot on each photo is their status. Use the dropdown beside it to show only active, exited or other people.",
          "Or pick them from the List of employees.",
          "Each card is one revision: the date it applies from, CTC and gross a month, basic, and any attached file.",
        ],
      },
      {
        title: "Add a revision",
        steps: [
          "Press New revision. It starts from the latest revision's amounts. Pick the effective date.",
          "Type CTC TOTAL and every amount by hand, each with its Pay Basis (Yearly, Monthly, Weekly, Daily or Hourly). What you type is saved exactly; a wage type left empty is not paid. The yearly figures, sub-totals and monthly gross fill in as you type.",
          "The CTC TOTAL remark is the reason for the revision. Attach the increment letter if you have one, then SAVE.",
        ],
      },
      {
        title: "Correct or delete a revision",
        steps: [
          "Press the pencil on a card to edit it, or the bin to delete it.",
          "Save & update future revisions carries the wage types you changed into every later revision too.",
        ],
      },
      {
        title: "Upload many salaries from Excel",
        steps: [
          "Press Bulk upload, then Download template: the Employee Salary Master sheet (Employee Code, WEF, Pay Basis, Replace all future salary revisions, CTC TOTAL, MONTHLY GROSS and a column per wage type).",
          "Fill the rows you want to change. A sheet exported from your old system uploads as it is.",
          "Check file shows every row as Ready, Error or Skipped, with notes to check. Save is possible only when no row has an error, and saves them all at once.",
        ],
      },
      {
        title: "Export present salaries",
        steps: [
          "In the List of employees, tick the people you want. Ticks stay when you go to the next page or search again; Select all ticks everyone in the list.",
          "Press Export: the Employee Salary Master sheet with each person's present salary, every wage type in its own column. Nothing ticked exports everyone the list shows.",
          "To revise many salaries at once, change WEF and the amounts in that sheet and upload it with Bulk upload.",
        ],
      },
      {
        title: "See who changed a salary",
        steps: ["Open the person and choose Change history: every change, who made it, when, and what moved."],
      },
    ],
    tips: [
      "A revision that an approved or paid payroll used is locked: payroll history stays as it was paid. Add a new revision and raise arrears instead.",
      "Dating a revision into a month already paid creates arrears, paid through Arrears.",
      "TDS, PROF. TAX, MPF, ESIC and LWF MANUAL: an amount there is deducted instead of what payroll works out for that person. Leave it empty and payroll works it out as usual.",
      "A week is 1/52 of a year; a month has 26 working days of 8 hours, for Weekly, Daily and Hourly amounts.",
    ],
  },

  "/payroll/adjustments": {
    summary: "Earnings and deductions outside the salary structure: incentives, bonuses, recoveries and court attachments.",
    tasks: [
      {
        title: "Add an adjustment",
        steps: [
          "Press New adjustment, choose the person, the component and the month.",
          "Enter the amount and reason, then save.",
        ],
      },
      {
        title: "Import many adjustments",
        steps: ["Press Import CSV, download the template, fill it and upload it."],
      },
    ],
  },

  "/payroll/setup": {
    summary: "Payroll's set-up pages in one place: structures, statutory rules, accounting and the pay programmes.",
    tasks: [
      {
        title: "Open a set-up page",
        steps: [
          "Pick a card: Salary structures, Statutory, Rule sets, Accounting, Gratuity & encashment, Benefits, Contractors, Earned wage access or Stock options.",
          "While you are on one, Payroll setup stays highlighted in the menu.",
        ],
      },
    ],
    tips: ["The monthly work (runs, salaries, adjustments, filings, bank files) stays in the Payroll menu."],
    related: [{ label: "Payroll runs", href: "/payroll" }],
  },

  "/payroll/structures": {
    summary: "Define salary components, build CTC templates from them, and preview how any CTC resolves.",
    tasks: [
      {
        title: "Create a component",
        steps: ["Press New component: name, type (earning or deduction), taxability and formula."],
      },
      {
        title: "Create a salary structure",
        steps: [
          "Press New structure and add components with their share of CTC.",
          "Use Resolve to preview how a sample CTC splits.",
        ],
      },
    ],
    tips: ["Grades and bands sets the salary range for each grade; press Add a grade."],
  },

  "/payroll/statutory": {
    summary: "PF elections, ESI coverage, work locations for PT and LWF, statutory bonus and registers.",
    tasks: [
      {
        title: "Record a PF election",
        steps: ["Open PF elections and press Record election for the person."],
      },
      {
        title: "Record a work-location posting",
        steps: ["Open Work locations and press Record posting, so PT and LWF follow the state."],
      },
      {
        title: "Compute and pay statutory bonus",
        steps: ["Open Bonus, press Compute, approve the amounts and then Pay."],
      },
    ],
  },

  "/payroll/rule-sets": {
    summary: "Versioned statutory rules, effective-dated by jurisdiction. Payroll computes only against approved versions.",
    tasks: [
      {
        title: "Enter a new rate",
        steps: [
          "Press New version for the rule set (for example PF or a state's PT).",
          "Enter the new values and the date they take effect, then submit it for approval.",
        ],
      },
    ],
    tips: [
      "A rule set is never edited in place: a change is a new version, so past runs keep the rates they used.",
      "Publish a statutory notice to tell people about a change.",
    ],
  },

  "/payroll/filings": {
    summary: "PF ECR, PF arrear ECR, ESIC, PT and TDS 24Q return files, TDS challans and Form 16 Part A.",
    tasks: [
      {
        title: "Prepare a return file",
        steps: ["In Returns, choose the return, legal entity, month and year, and press Validate and generate; open it to download the file."],
      },
      {
        title: "File PF on arrears",
        steps: [
          "After a month's payroll pays salary arrears, choose PF arrear ECR for that month.",
          "Upload it on the EPFO portal as an arrear ECR, separately from the month's regular ECR.",
        ],
      },
      {
        title: "Record a TDS challan",
        steps: [
          "Open TDS challans and press Record a challan with its BSR code, date and amount.",
          "Map the quarter's TDS to the challan.",
        ],
      },
    ],
  },

  "/payroll/disbursements": {
    summary: "Salary bank files with maker-checker.",
    tasks: [
      {
        title: "Prepare a salary file",
        steps: [
          "Set up a bank profile first (Bank profiles → Add bank profile).",
          "Press Prepare salary file for an approved run.",
          "A second person checks it; then download it for the bank.",
        ],
      },
      {
        title: "Pay everyone when one person has no bank account yet",
        steps: [
          "Open the blocked file and press Hold these, pay the rest; say why the salaries are held.",
          "Once their accounts are in, open the sent file and press Pay held salaries.",
        ],
      },
    ],
    tips: [
      "Employee accounts lists each person's bank account.",
      "A run has one salary file. Credits the bank returns are paid again from a supplementary batch, to the account on the employee's profile then.",
    ],
  },

  "/payroll/accounting": {
    summary: "Map payslip lines to your ledgers, then export any approved run as a journal.",
    tasks: [
      {
        title: "Export a payroll journal",
        steps: [
          "Map each payslip component to a ledger account and press Save mapping.",
          "Choose an approved run and export the journal for Tally, Zoho Books or your accounting system.",
        ],
      },
    ],
  },

  "/payroll/arrears": {
    summary: "Retrospective salary revisions and the arrears runs that pay them.",
    tasks: [
      {
        title: "Pay arrears",
        steps: [
          "Open New revision, press Add employee and enter the backdated change.",
          "Press Preview arrears, then approve the batch; it is paid in the chosen month.",
        ],
      },
    ],
    tips: ["Section 89(1) relief works out the tax relief on arrears for earlier years."],
  },

  "/payroll/loans": {
    summary: "Loan schemes, applications, disbursal and recovery, and reimbursement claims against bills.",
    tasks: [
      {
        title: "Set up a loan scheme",
        steps: ["Open Schemes and press New scheme: limits, interest and repayment months."],
      },
      {
        title: "Approve and disburse a loan",
        steps: ["Open Applications & loans, press Review on an application to approve it, then mark it disbursed. Apply on behalf applies for someone."],
      },
      {
        title: "Verify reimbursement claims",
        steps: ["Open Reimbursement claims and press Verify on each one after checking the bills."],
      },
    ],
  },

  "/payroll/settlements": {
    summary: "Full and final settlements for people who leave: holds, approvals and payment.",
    tasks: [
      {
        title: "Settle someone who left",
        steps: [
          "Open Awaiting settlement and press Compute.",
          "Check earnings and recoveries, get it approved, then record the payment.",
        ],
      },
    ],
  },

  "/payroll/gratuity": {
    summary: "Gratuity accrual and liability, payouts at exit, the rules behind them, and leave encashment.",
    tasks: [
      {
        title: "Review the gratuity liability",
        steps: ["Open Liability; press Run accrual in Accruals if it has not run this month."],
      },
      {
        title: "Set encashment policies",
        steps: ["Open Encashment and press New policy (or edit one) to set which leave can be encashed and how much."],
      },
    ],
  },

  "/payroll/tax-proofs": {
    summary: "Investment proof verification and the declaration and proof windows.",
    tasks: [
      {
        title: "Verify proofs",
        steps: ["Choose the financial year, check each proof (Download) and press Verify, or reject it with a reason."],
      },
      {
        title: "Open or close the proof window",
        steps: ["Set the window dates (tick Allow late submissions if needed) and press Save window. Send reminders now nudges people who have not submitted."],
      },
    ],
  },

  "/payroll/benefits": {
    summary: "Group plans, who is covered, changes to approve, and files for the insurer.",
    tasks: [
      {
        title: "Create a plan",
        steps: ["Press New plan with its cover, premium and who is eligible."],
      },
      {
        title: "Approve cover changes",
        steps: ["Approve or reject each life-event change waiting in the list."],
      },
    ],
  },

  "/payroll/contractors": {
    summary: "Consultants and vendors paid against invoices, with TDS under 194C and 194J worked out.",
    tasks: [
      {
        title: "Pay a contractor",
        steps: [
          "In Contractors, press Add a contractor with their PAN and TDS section.",
          "Press Enter an invoice; the TDS is worked out from the rule set.",
        ],
      },
    ],
    tips: ["The 26Q tab builds the quarterly TDS statement for contractors."],
  },

  "/payroll/ewa": {
    summary: "Advances on pay already earned this month, recovered in the same month's payroll.",
    tasks: [
      {
        title: "Switch earned wage access on or off",
        steps: ["Tick “People may draw earned pay early”, set the limit, and press Save policy."],
      },
    ],
  },

  "/payroll/esop": {
    summary: "Stock option plans, grants, fair values and exercises.",
    tasks: [
      {
        title: "Create a plan and grant options",
        steps: [
          "Press New plan with its pool and vesting schedule.",
          "Choose a person and use Grant to give them options.",
        ],
      },
      {
        title: "Record fair value or an exercise",
        steps: ["Use Fair value to enter the latest value, and Record an exercise when someone exercises."],
      },
    ],
  },

  "/reports": {
    summary: "Ready-made reports, your saved reports, a builder for your own, and scheduled delivery.",
    tasks: [
      {
        title: "Run a ready-made report",
        steps: ["Open the Library and press Use this on a report; run it and download the result if you need it."],
      },
      {
        title: "Ask a question in words",
        steps: ["Open the Ask tab, type a question like “headcount by department” and press Ask; check how it was read."],
      },
      {
        title: "Build, save and schedule a report",
        steps: [
          "Open Build, choose the data, then Add a column and Add filter; press Preview.",
          "Press Save report. In Saved reports, use Run, CSV, Pin or Schedule (to have it emailed).",
        ],
      },
    ],
    tips: ["You only see data your role allows, in every report."],
  },

  "/reports/dashboard": {
    summary: "Headcount, attrition and leave over time, and the patterns worth a conversation.",
    tasks: [
      {
        title: "Read the trends",
        steps: ["Switch between Workforce, Leave and absence, and Performance; change the period at the top."],
      },
    ],
    tips: ["In Pinned reports, choose a saved report and press Pin to keep it on this page."],
  },

  "/reports/bi": {
    summary: "What your BI tool may read, where it goes, and the record of every export.",
    tasks: [
      {
        title: "Connect a BI tool",
        steps: ["Press New connection, choose the datasets it may read, and copy its credentials."],
      },
    ],
  },

  "/compliance/privacy": {
    summary: "What AskMira holds about you, why, what you agreed to, and your rights over it.",
    tasks: [
      {
        title: "Give or withdraw consent",
        steps: [
          "Open My choices.",
          "Switch a purpose on to agree, or off to withdraw; the page tells you what changes.",
        ],
      },
      {
        title: "Exercise a right",
        steps: [
          "Open My rights: View or Download everything held about you, or press Correct, Request, Grievance or Nominate.",
        ],
      },
    ],
    tips: ["Ask Mira and the AI assistant need your consent to “AI assistant” here."],
  },

  "/compliance": {
    summary: "Data protection under the DPDP Act: rights requests, breaches, consent and the record of processing.",
    tasks: [
      {
        title: "Handle a rights request",
        steps: ["Open Rights requests, open a request and update it until it is completed."],
      },
      {
        title: "Report a breach",
        steps: ["Open Breaches and press Report a breach; tick “This is a rehearsal” for a drill."],
      },
    ],
  },

  "/compliance/retention": {
    summary: "How long each kind of data is kept, what freezes it, and every deletion carried out.",
    tasks: [
      {
        title: "Set a retention period",
        steps: ["Open Policies and press Edit on a data kind to set how long it is kept."],
      },
      {
        title: "Freeze data for a dispute",
        steps: ["Open Legal holds and press Place a hold; press Release when the matter is over."],
      },
      {
        title: "Approve a deletion run",
        steps: ["Open Runs: press Dry run over our records to see what would go, then Plan a real run; approve and execute it, or reject it."],
      },
    ],
  },

  "/compliance/security": {
    summary: "Sessions, access policy, recovery drills, penetration testing and SIEM delivery.",
    tasks: [
      {
        title: "Set the session policy",
        steps: ["Open Access policy, set the idle timeout, maximum session length and concurrent sessions, and press Save policy."],
      },
      {
        title: "Record a restore drill or pen-test finding",
        steps: ["Press Record a drill in Recovery drills, or Record a finding in Penetration testing."],
      },
    ],
  },

  "/compliance/ai": {
    summary: "What Mira's agents may do on their own, what they proposed, and how they are tested.",
    tasks: [
      {
        title: "Review agent proposals",
        steps: ["Open Proposals and accept or reject each proposed action. Revert one if needed."],
      },
      {
        title: "Change how much an agent may do",
        steps: ["Open Autonomy settings and press Change on the agent."],
      },
    ],
    tips: [
      "Transparency lists every AI feature, what it sends out and where.",
      "In Evaluation, Register the standard suites and Run them to test each agent.",
    ],
  },

  "/platform": {
    summary: "Every organisation on AskMira. Only the platform owner creates them; each admin then sets up their own.",
    tasks: [
      {
        title: "Create a workspace",
        steps: ["Create the organisation and its first admin's login."],
      },
      {
        title: "Add an admin or suspend a workspace",
        steps: ["Use Add an admin to give another admin a login, or Suspend to stop sign-ins."],
      },
      {
        title: "Fix an admin's email",
        steps: [
          "Use Change email next to the admin and give the right address.",
          "They get a new welcome email and temporary password; links sent to the wrong address stop working.",
        ],
      },
      {
        title: "Delete an organisation",
        steps: [
          "Open the row's menu, choose Delete organisation, give a reason and type its address to confirm.",
          "Everyone is signed out for good and it leaves the list; its records are kept as the law requires.",
        ],
      },
      {
        title: "Link the interview or expense tool",
        steps: ["Open the workspace's Linked products and link the product; people are synced every night."],
      },
    ],
  },
  "/platform/demo-requests": {
    summary: "Requests sent from the AskMira website's demo and contact forms. Only the platform team sees them.",
    tasks: [
      {
        title: "Follow up a new request",
        steps: [
          "Filter by New to see who is waiting, then click a row to open it.",
          "Email or call them from the links at the top, then set the status to Contacted.",
        ],
      },
      {
        title: "Keep notes",
        steps: [
          "Write what you learned in Notes and save. Only the platform team sees notes.",
          "Every status change and note change is recorded in the audit log.",
        ],
      },
      {
        title: "Turn a request into a workspace",
        steps: ["When they sign up, create their organisation under Workspaces and set the request to Closed."],
      },
    ],
  },

  "/operator": {
    summary: "Clients who granted you access to run their payroll, and what each is waiting on this month.",
    tasks: [
      {
        title: "Work in a client's workspace",
        steps: ["Pick the client; you act there with the access they granted, and a banner says so."],
      },
    ],
  },

  "/launch/[product]": {
    summary: "Opens a separate product your company uses, signed in as you.",
    tasks: [
      {
        title: "Open the product",
        steps: ["Wait a moment: you are taken there and signed in. If it cannot open, the page says why."],
      },
    ],
  },

  "/settings": {
    summary: "Workspace configuration, permissions, approval rules, custom fields, integrations, AI, operators, the audit trail and background jobs.",
    tasks: [
      {
        title: "Change workspace basics",
        steps: ["Open Workspace, change the name, financial year, week start or timezone, and press Save changes."],
      },
      {
        title: "Set who approves what",
        steps: ["Open Approval rules and press New rule for a request type: the approvers and their order."],
      },
      {
        title: "Switch AI features and Ask Mira on",
        steps: [
          "Open the AI tab and turn on “AI features for this workspace”.",
          "Turn on the features you want, such as Ask Mira chat, and press Save.",
          "Set up Ask Mira's name, greeting, tools and limits in the same tab.",
        ],
      },
      {
        title: "Add custom fields",
        steps: ["Open Custom fields and press Add a field (or Add a table): its type and which profile tab it appears on."],
      },
    ],
    tips: [
      "Permissions is the matrix of what each role may do; press Save after changing it.",
      "Integrations is where API keys (New key) and webhooks (New webhook) are made.",
      "Audit trail shows every change made in the workspace and by whom; Background jobs shows whether scheduled work ran, and Run starts one now.",
    ],
  },

  "/settings/organisation": {
    summary: "Legal entities, work locations and departments: the structures every other module uses.",
    tasks: [
      {
        title: "Add a legal entity, location or department",
        steps: ["Open the tab and press Add entity, Add location or Add department (or Edit on one), then save."],
      },
    ],
    tips: ["Payroll, statutory filings and attendance all depend on these being right."],
  },

  "/settings/users": {
    summary: "Who can sign in to this workspace, and what their role lets them reach.",
    tasks: [
      {
        title: "Give someone a login",
        steps: [
          "Press Add login, pick their employee record (it fills in their work email), and choose a role.",
          "Leave Email them their sign-in details ticked: they get their sign-in page, a link to set their own password and their onboarding checklist at that work email.",
          "If the email did not go, copy the one-time password and send it to them securely.",
        ],
      },
      {
        title: "Resend a welcome email",
        steps: ["Someone marked Password not set has not chosen a password yet. Press Resend welcome; the new link replaces the old one."],
      },
      {
        title: "Change a role or reset a password",
        steps: ["Use Role to change the role, Password to issue a new one, Relink to change the employee record, and Disable or Enable to stop or allow sign-in."],
      },
      {
        title: "Free an email for another login",
        steps: [
          "One email is one login across AskMira. If a login has the wrong email or is in the wrong workspace, press Delete and give a reason.",
          "The email can then be used for a login here or in another workspace, and the employee record can be given a new login.",
        ],
      },
    ],
    tips: [
      "A manager is not a role: anybody with direct reports gets the manager's pages.",
      "Welcome emails need a mail relay, set under Settings → Notifications.",
    ],
  },

  "/settings/modules": {
    summary: "Which parts of AskMira this workspace has switched on.",
    tasks: [
      {
        title: "Switch a module on or off",
        steps: ["Turn the module's switch on or off; its pages appear or disappear from the menu."],
      },
    ],
  },

  "/settings/sso": {
    summary: "Identity providers, the break-glass account, and directory sync tokens.",
    tasks: [
      {
        title: "Set up single sign-on",
        steps: [
          "In Identity providers, press Add provider.",
          "Copy the values from Endpoints for your IdP into your provider.",
        ],
      },
      {
        title: "Sync your directory",
        steps: ["Open Directory sync and press New token for your provider."],
      },
    ],
  },

  "/settings/connectors": {
    summary:
      "Connect the other products your company uses — AnytimeHire for hiring, ExpenseGenie for expenses, CGB Helpdesk for IT tickets and assets — with one click. Each connection belongs to this workspace alone.",
    tasks: [
      {
        title: "Connect a product",
        steps: [
          "Press Connect on the product.",
          "Sign in to the product as an admin of your organisation there, check the request names your AskMira workspace, and press Allow. In CGB Helpdesk, also choose which company it is.",
          "You come back here connected; your people are sent across at once.",
        ],
      },
      {
        title: "Keep people in step",
        steps: [
          "People are sent across every night. Press Sync people now after a big change.",
          "Anyone skipped is listed with the reason (for example, their email belongs to another organisation there, or — in CGB Helpdesk — is not on the company's email domain).",
        ],
      },
      {
        title: "Disconnect",
        steps: [
          "Press Disconnect and confirm. The product forgets this workspace's key; nothing is deleted on either side.",
        ],
      },
      {
        title: "If a product moves to a new domain",
        steps: [
          "Press Change address on the product and enter its new web address and server (API) address.",
          "AskMira checks the server address answers as that product before saving. A connection keeps working; you do not need to connect again.",
          "Use the standard address puts it back on the product's usual address.",
        ],
      },
    ],
    tips: [
      "The key a product issues reaches only your organisation there, never another company's.",
      "Once connected, Expenses, Hiring, Helpdesk and Assets show the product's records, and Ask Mira can answer from them.",
      "AskMira never changes anyone's role in CGB Helpdesk: its IT team decides who are engineers and admins. HR see their own company's tickets and assets here, and leavers can no longer sign in there.",
    ],
  },

  "/settings/connectors/callback": {
    summary: "Finishing a connection after you pressed Allow in the product. You are taken back to Connectors.",
    tasks: [
      {
        title: "If it says not connected",
        steps: ["Go back to Connectors and press Connect again; a connect link is good for 15 minutes."],
      },
    ],
  },

  "/settings/devices": {
    summary: "Biometric and attendance devices, what they have sent, and punches that need a person attached.",
    tasks: [
      {
        title: "Register a device",
        steps: [
          "Press Register device: its ID, vendor, name, work location and clock timezone.",
          "Copy the push token or server address into the device, then save. Rotate token issues a new one.",
        ],
      },
      {
        title: "Resolve punches with no person",
        steps: ["Open Exceptions and press Resolve to attach each punch to the right person."],
      },
    ],
  },

  "/settings/notifications": {
    summary: "Which channels deliver, when people may be disturbed, and what the messages say.",
    tasks: [
      {
        title: "Set quiet hours",
        steps: ["Open Quiet hours & limits, set when messages are held back, and press Save policy."],
      },
      {
        title: "Use your own mail server or WhatsApp account",
        steps: ["Open Mail relay (Save relay, then Send a test to myself) or WhatsApp, and enter the account details."],
      },
      {
        title: "Put your logo and colours on every email",
        steps: [
          "Open Email design and upload the company logo.",
          "Pick the brand colour, and write a sign-off and a footer (address, HR contact).",
          "Watch the preview, press Send me a test, then Save design.",
        ],
      },
      {
        title: "Change what an email says",
        steps: [
          "Open Emails & messages and find the message by searching or by area.",
          "Press Edit, change the subject and message, and insert values such as {employee_name}.",
          "Check the preview, send yourself a test, and press Save new version. Use the built-in wording undoes it.",
        ],
      },
      {
        title: "Let managers approve from the email",
        steps: [
          "Open Email design and keep Approve or reject from the email switched on.",
          "Approval emails (leave, missed punch, timesheets, claims, assets) then carry Approve and Reject; the manager adds a comment and confirms.",
        ],
      },
    ],
  },
};

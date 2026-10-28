"use client";

import { Award, BookOpen, Download, GraduationCap, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { NoEmployeeRecord, useHasEmployeeRecord } from "@/components/common/NoEmployeeRecord";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post } from "@/lib/api";
import { formatDay, toISODate } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";
import { FieldLegend, FieldSet } from "@/components/ui/field";

interface Assignment {
  id: string;
  course: string;
  kind: string;
  due_on: string;
  status: "assigned" | "completed" | "cancelled";
  overdue: boolean;
  attempts: number;
  score: number | null;
  completed_at: string | null;
  expires_on: string | null;
  expired: boolean;
  certificate_number: string | null;
}

interface CourseContent {
  title: string;
  description: string | null;
  modules: { title: string; body: string | null; url: string | null }[];
  quiz: { question: string; options: string[] }[];
  pass_mark: number;
}

interface CourseRow {
  id: string;
  title: string;
  kind: string;
  modules: unknown[];
  quiz: unknown[];
  pass_mark: number;
  validity_months: number | null;
  active: boolean;
}

interface Report {
  assigned: number;
  completed: number;
  overdue: number;
  expired: number;
  people: (Assignment & { employee_name: string; employee_code: string })[];
}

const KIND_LABEL: Record<string, string> = {
  posh: "POSH",
  compliance: "Compliance",
  safety: "Safety",
  skill: "Skill",
  other: "Other",
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

async function downloadCertificate(row: Assignment) {
  try {
    await downloadFile(`/learning/assignments/${row.id}/certificate`, `certificate-${row.certificate_number}.pdf`);
  } catch (caught) {
    toast.error(failure(caught, "The certificate could not be downloaded."));
  }
}

/** The person's courses: to do, done, and their certificates. */
export function MyLearningScreen() {
  const hasRecord = useHasEmployeeRecord();
  const { data, error, isLoading, reload } = useApiQuery<Assignment[]>(hasRecord ? "/learning/me" : null);
  const [open, setOpen] = useState<Assignment | null>(null);
  const rows = data ?? [];
  if (!hasRecord) {
    return (
      <PageShell title="My courses" description="Courses you have been asked to complete, and your certificates.">
        <NoEmployeeRecord what="Courses and certificates" />
      </PageShell>
    );
  }
  return (
    <PageShell title="My courses" description="Courses you have been asked to complete, and your certificates.">
      <DataPanel
        tier="tier2"
        title="Courses"
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ icon: GraduationCap, title: "No courses assigned" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.course}</p>
                  <p className="text-xs text-muted-foreground">{KIND_LABEL[row.kind] ?? row.kind}</p>
                </TableCell>
                <TableCell>{formatDay(row.due_on, true)}</TableCell>
                <TableCell>
                  {row.status === "completed" ? (
                    <Badge variant={row.expired ? "warning" : "success"}>
                      {row.expired ? "Expired" : `Done · ${row.score}%`}
                    </Badge>
                  ) : (
                    <Badge variant={row.overdue ? "warning" : "outline"}>{row.overdue ? "Overdue" : "To do"}</Badge>
                  )}
                  {row.expires_on && !row.expired && <p className="text-xs text-muted-foreground">Valid until {formatDay(row.expires_on, true)}</p>}
                </TableCell>
                <TableCell className="text-right">
                  {row.status === "assigned" ? (
                    <Button size="sm" onClick={() => setOpen(row)}>
                      <BookOpen /> Start
                    </Button>
                  ) : (
                    row.certificate_number && (
                      <Button size="sm" variant="outline" onClick={() => void downloadCertificate(row)}>
                        <Download /> Certificate
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {open && (
        <CourseDialog
          assignment={open}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </PageShell>
  );
}

function CourseDialog({ assignment, onClose, onDone }: { assignment: Assignment; onClose: () => void; onDone: () => void }) {
  const { data } = useApiQuery<{ content: CourseContent }>(`/learning/me/${assignment.id}`);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; pass_mark: number } | null>(null);
  const content = data?.content;
  const quiz = content?.quiz ?? [];

  const submit = async () => {
    setBusy(true);
    try {
      const done = await post<{ passed: boolean; score: number; pass_mark: number }>(`/learning/me/${assignment.id}/complete`, {
        answers: quiz.map((_, i) => answers[i] ?? -1),
      });
      setResult(done);
      if (done.passed) {
        toast.success(`Passed with ${done.score}%.`);
        onDone();
      }
    } catch (caught) {
      toast.error(failure(caught, "Your answers could not be sent."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{content?.title ?? assignment.course}</DialogTitle>
          {content?.description && <DialogDescription>{content.description}</DialogDescription>}
        </DialogHeader>
        {!content ? (
          <Loader2 className="mx-auto animate-spin" />
        ) : (
          <div className="grid gap-5">
            {content.modules.map((module, i) => (
              <section key={i} className="grid gap-1">
                <h3 className="font-medium">
                  {i + 1}. {module.title}
                </h3>
                {module.body && <p className="whitespace-pre-line text-sm">{module.body}</p>}
                {module.url && (
                  <Button asChild variant="link" className="h-auto justify-self-start p-0">
                    <a href={module.url} target="_blank" rel="noopener noreferrer">
                      Open the material
                    </a>
                  </Button>
                )}
              </section>
            ))}
            {quiz.length > 0 ? (
              <section className="grid gap-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Pass mark {content.pass_mark}%.</p>
                {quiz.map((q, qi) => (
                  <FieldSet key={qi} className="grid gap-2">
                    <FieldLegend className="mb-1 text-sm font-medium">
                      {qi + 1}. {q.question}
                    </FieldLegend>
                    {q.options.map((option, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Checkbox
                          id={`q${qi}-o${oi}`}
                          checked={answers[qi] === oi}
                          onCheckedChange={(on) => on && setAnswers((c) => ({ ...c, [qi]: oi }))}
                        />
                        <Label htmlFor={`q${qi}-o${oi}`} className="font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </FieldSet>
                ))}
              </section>
            ) : (
              <div className="flex items-center gap-2 border-t border-border pt-4">
                <Checkbox id="course-read" checked={read} onCheckedChange={(on) => setRead(Boolean(on))} />
                <Label htmlFor="course-read" className="font-normal">
                  I have read and understood this course
                </Label>
              </div>
            )}
            {result && !result.passed && (
              <Alert variant="warning">
                <AlertDescription>
                  You scored {result.score}%; the pass mark is {result.pass_mark}%. Read the modules again and retry.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button disabled={busy || !content || (quiz.length > 0 ? Object.keys(answers).length < quiz.length : !read)} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} {quiz.length > 0 ? "Submit answers" : "Mark complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** HR: courses, who has done them, assigning. */
export function LearningAdminScreen() {
  const { data, error, isLoading, reload } = useApiQuery<CourseRow[]>("/learning/courses");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<CourseRow | null>(null);
  const [viewing, setViewing] = useState<CourseRow | null>(null);
  return (
    <PageShell title="Courses" description="POSH, compliance, safety and skills courses: write them, assign them, see who has completed them.">
      <DataPanel
        tier="tier1"
        title="Courses"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New course
          </Button>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: GraduationCap, title: "No courses yet", description: "Write the course content your Internal Committee or trainers approve." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Quiz</TableHead>
              <TableHead>Renew</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell>{KIND_LABEL[course.kind] ?? course.kind}</TableCell>
                <TableCell>{course.quiz.length ? `${course.quiz.length} questions, pass ${course.pass_mark}%` : "None"}</TableCell>
                <TableCell>{course.validity_months ? `Every ${course.validity_months} months` : "Never"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewing(course)}>
                      <Award /> Completion
                    </Button>
                    <Button size="sm" onClick={() => setAssigning(course)}>
                      Assign
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {viewing && <CourseReport course={viewing} />}
      {creating && <NewCourseDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {assigning && <AssignDialog course={assigning} onClose={() => setAssigning(null)} onDone={() => setAssigning(null)} />}
    </PageShell>
  );
}

function CourseReport({ course }: { course: CourseRow }) {
  const { data } = useApiQuery<Report>(`/learning/courses/${course.id}/report`);
  if (!data) return null;
  return (
    <Card tier="tier1" className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">{course.title}</CardTitle>
        <CardDescription>
          {data.completed} of {data.assigned} complete · {data.overdue} overdue · {data.expired} expired
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.people.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.employee_name} <span className="text-xs text-muted-foreground">{p.employee_code}</span>
                </TableCell>
                <TableCell>{formatDay(p.due_on, true)}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "completed" ? (p.expired ? "warning" : "success") : p.overdue ? "warning" : "outline"}>
                    {p.status === "completed" ? (p.expired ? "Expired" : `Done · ${p.score}%`) : p.overdue ? "Overdue" : "To do"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {p.certificate_number && (
                    <Button size="sm" variant="ghost" onClick={() => void downloadCertificate(p)}>
                      <Download /> Certificate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface DraftQuestion {
  question: string;
  options: string;
  correct: number;
}

function NewCourseDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("compliance");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState([{ title: "", body: "" }]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [passMark, setPassMark] = useState("70");
  const [validity, setValidity] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post("/learning/courses", {
        title: title.trim(),
        kind,
        description: description.trim() || null,
        modules: modules.filter((m) => m.title.trim()).map((m) => ({ title: m.title.trim(), body: m.body.trim() || null })),
        quiz: questions.map((q) => ({ question: q.question.trim(), options: q.options.split("\n").map((o) => o.trim()).filter(Boolean), correct: q.correct })),
        pass_mark: Number(passMark) || 0,
        validity_months: validity ? Number(validity) : null,
      });
      toast.success("Course created.");
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "The course could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>Modules to read and, if you want one, a quiz. Learners never see the answers.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <FormField htmlFor="course-title" label="Title">
              <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField htmlFor="course-kind" label="Kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="course-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="course-description" label="Description" optional>
            <Textarea id="course-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="grid gap-2">
            <Label>Modules</Label>
            {modules.map((m, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border p-3">
                <Input aria-label="Module title" placeholder="Title" value={m.title} onChange={(e) => setModules((c) => c.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Textarea aria-label="Module text" rows={4} placeholder="What to read" value={m.body} onChange={(e) => setModules((c) => c.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setModules((c) => [...c, { title: "", body: "" }])}>
              <Plus /> Add a module
            </Button>
          </div>
          <div className="grid gap-2">
            <Label>Quiz</Label>
            {questions.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <Input aria-label="Question" placeholder="Question" value={q.question} onChange={(e) => setQuestions((c) => c.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => setQuestions((c) => c.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
                <Textarea aria-label="Options, one per line" rows={3} placeholder="Options, one per line" value={q.options} onChange={(e) => setQuestions((c) => c.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} />
                <FormField htmlFor={`q-correct-${i}`} label="Correct option number">
                  <Input id={`q-correct-${i}`} inputMode="numeric" className="w-24" value={String(q.correct + 1)} onChange={(e) => setQuestions((c) => c.map((x, j) => (j === i ? { ...x, correct: Math.max(0, Number(e.target.value.replace(/\D/g, "")) - 1) } : x)))} />
                </FormField>
              </div>
            ))}
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setQuestions((c) => [...c, { question: "", options: "", correct: 0 }])}>
              <Plus /> Add a question
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="course-pass" label="Pass mark (%)">
              <Input id="course-pass" inputMode="numeric" value={passMark} onChange={(e) => setPassMark(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="course-validity" label="Renew every (months)" optional hint="POSH awareness is usually yearly.">
              <Input id="course-validity" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value.replace(/\D/g, ""))} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || title.trim().length < 3 || !modules.some((m) => m.title.trim())} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ course, onClose, onDone }: { course: CourseRow; onClose: () => void; onDone: () => void }) {
  const [due, setDue] = useState(toISODate(new Date(Date.now() + 14 * 86_400_000)));
  const [busy, setBusy] = useState(false);
  const assign = async () => {
    setBusy(true);
    try {
      const result = await post<{ assigned: number; already_current: number }>(`/learning/courses/${course.id}/assign`, { everyone: true, due_on: due });
      toast.success(`Assigned to ${result.assigned}; ${result.already_current} already current.`);
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "The course could not be assigned."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {course.title}</DialogTitle>
          <DialogDescription>To everyone currently employed. Anyone already holding a valid completion is skipped.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="assign-due" label="Due by">
          <DatePicker id="assign-due" value={due} onChange={setDue} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !due} onClick={() => void assign()}>
            {busy && <Loader2 className="animate-spin" />} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

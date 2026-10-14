"use client";

import { BookOpen, Loader2, MessageCircleQuestion, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { ApiError, del, patch, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import { aiAvailable, useAiStatus } from "./aiStatus";

interface Citation {
  number: number;
  id: string;
  source: string;
  label: string;
  href: string | null;
}

interface Answer {
  invocation_id: string | null;
  outcome: "answered" | "partially_answered" | "refused" | "withheld";
  answer: string;
  citations: Citation[];
  confidence: number | null;
  confidence_band: string | null;
  refusal_reasons: string[];
  answered_from: "policy" | "your_record";
  open?: string;
}

interface Exchange {
  question: string;
  reply: Answer;
}

interface Article {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_published: boolean;
  updated_at: string | null;
}

interface Report {
  days: number;
  total: number;
  by_outcome: Record<string, number>;
  answer_rate: number | null;
  unanswered: { question: string | null; outcome: string; reasons: string[]; asked_at: string }[];
}

const OUTCOME_LABEL: Record<Answer["outcome"], string> = {
  answered: "Answered",
  partially_answered: "Partly answered",
  refused: "Not answered",
  withheld: "Withheld",
};

/**
 * Ask HR — the policy assistant (HR-10).
 *
 * Answers come only from what HR published here, the company's leave rules and
 * holidays, each sentence linked to its source. A question about your own
 * record is answered from AskMira's own data, which never goes to the model.
 */
export function AssistantScreen() {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);
  return (
    <PageShell
      title="Ask HR"
      description="Policy questions answered from what your HR team published, with the source of every line."
    >
      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">Ask</TabsTrigger>
          <TabsTrigger value="articles">Policies</TabsTrigger>
          {isHr ? <TabsTrigger value="report">What people ask</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="ask" className="mt-4">
          <AskTab />
        </TabsContent>
        <TabsContent value="articles" className="mt-4">
          <ArticlesTab />
        </TabsContent>
        <RequireRole roles={HR}>
          <TabsContent value="report" className="mt-4">
            <ReportTab />
          </TabsContent>
        </RequireRole>
      </Tabs>
    </PageShell>
  );
}

function AskTab() {
  const status = useAiStatus();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);

  if (status.isLoading) return null;
  if (!aiAvailable(status.data, "assistant")) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="The assistant is not turned on"
        description={
          status.data?.configured === false
            ? "This server has no AI provider configured."
            : "Your organisation has not switched on the policy assistant. HR can turn it on in Settings."
        }
      />
    );
  }
  if (!status.data?.my_consent) {
    return (
      <Alert>
        <ShieldCheck />
        <AlertTitle>You have not agreed to the AI assistant</AlertTitle>
        <AlertDescription>
          <p>
            Your question and the company policy it needs are sent to an AI provider outside India.
            Nothing is sent until you agree.
          </p>
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/compliance/privacy">Review it under My privacy</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ask = async () => {
    const text = question.trim();
    if (text.length < 3) return;
    setBusy(true);
    try {
      const reply = await post<Answer>("/assistant/ask", { question: text });
      setHistory((current) => [{ question: text, reply }, ...current]);
      setQuestion("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card tier="tier2">
        <CardContent className="grid gap-3 pt-6">
          <Label htmlFor="assistant-question">Your question</Label>
          <Textarea
            id="assistant-question"
            value={question}
            maxLength={1000}
            rows={3}
            placeholder="How many casual leaves do we get in a year?"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void ask();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Answers cite your company&apos;s published policy. Questions about your own record are
              answered from AskMira, not by the AI.
            </p>
            <Button onClick={ask} disabled={busy || question.trim().length < 3}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Ask
            </Button>
          </div>
        </CardContent>
      </Card>

      {history.map((exchange, index) => (
        <Card key={`${exchange.reply.invocation_id ?? index}`} tier="tier2">
          <CardHeader>
            <CardDescription>{exchange.question}</CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-normal">
              <Badge variant={exchange.reply.outcome === "answered" ? "secondary" : "outline"}>
                {exchange.reply.answered_from === "your_record"
                  ? "From your record"
                  : OUTCOME_LABEL[exchange.reply.outcome]}
              </Badge>
              {exchange.reply.confidence_band ? (
                <Badge variant="outline">Confidence: {exchange.reply.confidence_band}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="whitespace-pre-line text-sm leading-6">{exchange.reply.answer}</p>
            {exchange.reply.citations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {exchange.reply.citations.map((citation) => (
                  <Button key={citation.id} asChild variant="outline" size="sm">
                    <Link href={citation.href ?? "#"}>
                      [{citation.number}] {citation.label}
                    </Link>
                  </Button>
                ))}
              </div>
            ) : null}
            {exchange.reply.open ? (
              <Button asChild variant="link" className="h-auto justify-start p-0">
                <Link href={exchange.reply.open}>Open the page</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const EMPTY_ARTICLE = { title: "", body: "", category: "", is_published: true };

function ArticlesTab() {
  const { data, error, isLoading, reload } = useApiQuery<Article[]>("/assistant/articles");
  const [editing, setEditing] = useState<Article | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState<Article | null>(null);

  const start = (article: Article | null) => {
    setEditing(article);
    setForm(
      article
        ? {
            title: article.title,
            body: article.body,
            category: article.category ?? "",
            is_published: article.is_published,
          }
        : EMPTY_ARTICLE,
    );
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const body = { ...form, category: form.category.trim() || null };
    try {
      if (editing) await patch(`/assistant/articles/${editing.id}`, body);
      else await post("/assistant/articles", body);
      toast.success("Saved.");
      setOpen(false);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (article: Article) => {
    try {
      await del(`/assistant/articles/${article.id}`);
      toast.success("Deleted.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not delete.");
    }
  };

  return (
    <>
      <DataPanel
        title="Policies"
        description="What the assistant answers from. Only published policies are used."
        tier="tier2"
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{
          icon: BookOpen,
          title: "No policies published yet",
          description: "Until HR publishes some, the assistant can only answer from leave rules and holidays.",
        }}
        actions={
          <RequireRole roles={HR}>
            <Button onClick={() => start(null)}>
              <Plus className="size-4" />
              New policy
            </Button>
          </RequireRole>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">
                  {article.title}
                  {!article.is_published ? (
                    <Badge variant="outline" className="ml-2">
                      Draft
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{article.category ?? "—"}</TableCell>
                <TableCell>{article.updated_at ? formatDate(article.updated_at) : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setReading(article)}>
                    Read
                  </Button>
                  <RequireRole roles={HR}>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => start(article)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(article)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </RequireRole>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <Dialog open={reading !== null} onOpenChange={(next) => !next && setReading(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reading?.title}</DialogTitle>
            {reading?.category ? <DialogDescription>{reading.category}</DialogDescription> : null}
          </DialogHeader>
          <p className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm leading-6">{reading?.body}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit policy" : "New policy"}</DialogTitle>
            <DialogDescription>
              Write it as you would for an employee. The assistant quotes it and links to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Title" htmlFor="article-title">
              <Input
                id="article-title"
                value={form.title}
                maxLength={200}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </FormField>
            <FormField label="Category" htmlFor="article-category">
              <Input
                id="article-category"
                value={form.category}
                maxLength={64}
                placeholder="Leave, Travel, Conduct…"
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </FormField>
            <FormField label="Policy text" htmlFor="article-body">
              <Textarea
                id="article-body"
                value={form.body}
                rows={10}
                maxLength={20000}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            </FormField>
            <div className="flex items-center gap-3">
              <Switch
                id="article-published"
                checked={form.is_published}
                onCheckedChange={(checked) => setForm({ ...form, is_published: checked })}
              />
              <Label htmlFor="article-published">Published — the assistant may answer from it</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || form.title.trim().length < 3 || form.body.trim().length < 10}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportTab() {
  const { data, error, isLoading, reload } = useApiQuery<Report>("/assistant/report?days=30");
  return (
    <DataPanel
      title="What people asked in the last 30 days"
      description="Questions the assistant could not answer are the gaps in your published policy. Who asked is not shown."
      tier="tier2"
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      isEmpty={(data?.total ?? 0) === 0}
      empty={{ icon: MessageCircleQuestion, title: "No questions yet" }}
    >
      {data ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.total} questions</Badge>
            {data.answer_rate !== null ? (
              <Badge variant="outline">{Math.round(data.answer_rate * 100)}% answered</Badge>
            ) : null}
            {Object.entries(data.by_outcome).map(([outcome, count]) => (
              <Badge key={outcome} variant="outline">
                {outcome.replaceAll("_", " ")}: {count}
              </Badge>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Not answered</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.unanswered.map((row, index) => (
                <TableRow key={`${row.asked_at}-${index}`}>
                  <TableCell>{row.question ?? "—"}</TableCell>
                  <TableCell>{row.reasons.map((r) => r.replaceAll("_", " ")).join(", ") || row.outcome}</TableCell>
                  <TableCell>{formatDate(row.asked_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </DataPanel>
  );
}

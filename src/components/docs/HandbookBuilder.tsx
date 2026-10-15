"use client";

import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Section {
  heading: string;
  body: string;
}

interface Handbook {
  id: string;
  title: string;
  sections: Section[];
  requires_acknowledgement: boolean;
  document_id: string | null;
  version: number;
  published_at: string | null;
  has_unpublished_changes: boolean;
}

const failed = (caught: unknown, fallback: string) =>
  toast.error(caught instanceof ApiError ? caught.detail : fallback);

/** HR: handbooks written in the app, section by section, published into the library. */
export function HandbookBuilder({ onPublished }: { onPublished: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Handbook[]>("/documents/company/handbooks");
  const [open, setOpen] = useState<Handbook | "new" | null>(null);

  return (
    <>
      <DataPanel
        tier="tier1"
        title="Handbooks"
        description="Write a handbook here in sections. Publishing turns it into a PDF in the library above; republishing asks everyone to acknowledge the new version."
        actions={
          <Button size="sm" variant="outline" onClick={() => setOpen("new")}>
            <Plus /> New handbook
          </Button>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: BookOpen, title: "No handbooks yet", description: "Start one to write it in the app." }}
      >
        <ul className="divide-y divide-border">
          {(data ?? []).map((book) => (
            <li key={book.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <p className="font-medium">{book.title}</p>
                <p className="text-xs text-muted-foreground">
                  {book.sections.length} section(s) ·{" "}
                  {book.published_at ? `version ${book.version}, published ${formatDate(book.published_at)}` : "never published"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {book.has_unpublished_changes && book.version > 0 && <Badge variant="warning">Unpublished changes</Badge>}
                <Button size="sm" variant="outline" onClick={() => setOpen(book)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DataPanel>
      <HandbookEditor
        handbook={open}
        onClose={() => setOpen(null)}
        onSaved={() => {
          reload();
        }}
        onPublished={() => {
          reload();
          onPublished();
        }}
      />
    </>
  );
}

function HandbookEditor({
  handbook,
  onClose,
  onSaved,
  onPublished,
}: {
  handbook: Handbook | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  onPublished: () => void;
}) {
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [acknowledge, setAcknowledge] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (handbook === "new") {
      setId(null);
      setTitle("Employee handbook");
      setSections([{ heading: "Welcome", body: "" }]);
      setAcknowledge(true);
    } else if (handbook) {
      setId(handbook.id);
      setTitle(handbook.title);
      setSections(handbook.sections.length ? handbook.sections : [{ heading: "", body: "" }]);
      setAcknowledge(handbook.requires_acknowledgement);
    }
  }, [handbook]);

  const change = (index: number, patch: Partial<Section>) =>
    setSections((prev) => prev.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  const move = (index: number, by: number) =>
    setSections((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  const valid = title.trim() !== "" && sections.every((section) => section.heading.trim() !== "");

  const save = async (): Promise<string | null> => {
    const body = { title, sections, requires_acknowledgement: acknowledge };
    const saved = id
      ? await put<Handbook>(`/documents/company/handbooks/${id}`, body)
      : await post<Handbook>("/documents/company/handbooks", body);
    setId(saved.id);
    onSaved();
    return saved.id;
  };

  const run = async (publish: boolean) => {
    setBusy(true);
    try {
      const savedId = await save();
      if (publish && savedId) {
        const published = await post<Handbook>(`/documents/company/handbooks/${savedId}/publish`);
        toast.success(`Version ${published.version} published to the library.`);
        onPublished();
        onClose();
      } else {
        toast.success("Draft saved. Employees still see the last published version.");
      }
    } catch (caught) {
      failed(caught, publish ? "The handbook was not published." : "The draft was not saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={handbook !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{handbook === "new" ? "New handbook" : "Edit handbook"}</SheetTitle>
          <SheetDescription>
            Plain text: a blank line starts a new paragraph, and lines starting with &quot;- &quot; become a list.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <FormField htmlFor="handbook-title" label="Title">
            <Input id="handbook-title" maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>
          <div className="flex items-center gap-2">
            <Checkbox
              id="handbook-ack"
              checked={acknowledge}
              onCheckedChange={(checked) => setAcknowledge(checked === true)}
            />
            <Label htmlFor="handbook-ack" className="font-normal">
              Every employee must read and acknowledge it
            </Label>
          </div>
          {sections.map((section, index) => (
            <Card key={index} tier="tier1">
              <CardContent className="grid gap-2 pt-4">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Section ${index + 1} heading`}
                    placeholder={`Section ${index + 1} heading`}
                    maxLength={200}
                    value={section.heading}
                    onChange={(event) => change(index, { heading: event.target.value })}
                  />
                  <Button size="icon" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={index === sections.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove section"
                    onClick={() => setSections((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  aria-label={`Section ${index + 1} text`}
                  rows={6}
                  maxLength={20000}
                  value={section.body}
                  onChange={(event) => change(index, { body: event.target.value })}
                />
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            className="w-fit"
            disabled={sections.length >= 100}
            onClick={() => setSections((prev) => [...prev, { heading: "", body: "" }])}
          >
            <Plus /> Add a section
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !valid} onClick={() => void run(false)}>
              Save draft
            </Button>
            <Button disabled={busy || !valid || sections.length === 0} onClick={() => void run(true)}>
              Publish
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

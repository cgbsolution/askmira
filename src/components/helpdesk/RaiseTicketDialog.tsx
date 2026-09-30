"use client";

import { Loader2, Lock, Plus, UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { HelpdeskCategory, TicketPriority, TicketSummary } from "@/lib/types/helpdesk";

import { AttachmentPicker, InlineError, PRIORITIES, PRIORITY_LABEL, errorDetail } from "./shared";

/**
 * Raise a ticket: category, priority, subject, description and one optional
 * file. With `onBehalf`, HR picks the employee the ticket is for.
 */
export function RaiseTicketDialog({
  categories,
  onCreated,
  onBehalf = false,
}: {
  categories: HelpdeskCategory[];
  onCreated: (ticket: TicketSummary) => void;
  onBehalf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const category = categories.find((item) => item.id === categoryId);

  const reset = () => {
    setCategoryId("");
    setPriority("medium");
    setSubject("");
    setDescription("");
    setFile(null);
    setEmployee(null);
    setError(null);
  };

  const save = async () => {
    if (onBehalf && !employee) return setError("Pick the employee this ticket is for.");
    if (!categoryId) return setError("Pick what the ticket is about.");
    if (!subject.trim() || !description.trim()) {
      return setError("Give the ticket a subject and describe what you need.");
    }
    setError(null);
    setIsSaving(true);
    try {
      const form = new FormData();
      form.append("category_id", categoryId);
      form.append("priority", priority);
      form.append("subject", subject.trim());
      form.append("description", description.trim());
      if (onBehalf && employee) form.append("employee_id", employee.id);
      if (file) form.append("file", file);
      const created = await post<TicketSummary>("/helpdesk/tickets", form);
      toast.success(`${created.ticket_number} raised`, {
        description: created.assignee_name
          ? `${created.assignee_name} is looking after it.`
          : "HR will pick it up from the helpdesk queue.",
      });
      setOpen(false);
      reset();
      onCreated(created);
    } catch (caught) {
      setError(errorDetail(caught, "Could not raise the ticket."));
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = categories.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={onBehalf ? "outline" : "default"} disabled={disabled}>
          {onBehalf ? <UserPlus /> : <Plus />}
          {onBehalf ? "Raise on behalf" : "Raise a ticket"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{onBehalf ? "Raise a ticket for an employee" : "Raise a ticket"}</DialogTitle>
          <DialogDescription>
            {onBehalf
              ? "The ticket is the employee's: they see it, get the replies and can rate it."
              : "Ask HR for anything — a letter, a salary query, a lost ID card. You can follow the conversation here."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {onBehalf && (
            <FormField htmlFor="ticket-employee" label="Employee" required>
              <EmployeePicker
                id="ticket-employee"
                value={employee}
                onChange={setEmployee}
                excludeId={null}
                disabled={isSaving}
              />
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <FormField htmlFor="ticket-category" label="Category" required>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={isSaving}>
                <SelectTrigger id="ticket-category" className="w-full">
                  <SelectValue placeholder="What is it about?" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="ticket-priority" label="Priority">
              <Select
                value={priority}
                onValueChange={(next) => setPriority(next as TicketPriority)}
                disabled={isSaving}
              >
                <SelectTrigger id="ticket-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIORITY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {category && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
              {category.description && <p className="text-foreground">{category.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                Usually resolved within {category.sla_hours} hours
                {category.owner_name ? ` · handled by ${category.owner_name}` : " · handled by HR"}
              </p>
              {category.is_confidential && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  Confidential: seen only by you, the category owner and HR admins.
                </p>
              )}
            </div>
          )}
          <FormField htmlFor="ticket-subject" label="Subject" required>
            <Input
              id="ticket-subject"
              value={subject}
              maxLength={200}
              disabled={isSaving}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Address-proof letter for a rental agreement"
            />
          </FormField>
          <FormField htmlFor="ticket-description" label="Description" required>
            <Textarea
              id="ticket-description"
              rows={5}
              maxLength={10_000}
              value={description}
              disabled={isSaving}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What do you need, and by when? Include anything HR will ask for."
            />
          </FormField>
          <FormField
            htmlFor="ticket-file"
            label="Attachment"
            optional
            hint="One PDF, PNG or JPEG. The type is checked from the file itself."
          >
            <AttachmentPicker id="ticket-file" file={file} onChange={setFile} disabled={isSaving} />
          </FormField>
          {error && <InlineError>{error}</InlineError>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Raise ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

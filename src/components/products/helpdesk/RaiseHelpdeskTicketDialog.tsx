"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { InlineError, errorDetail } from "@/components/helpdesk/shared";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";

import { PRIORITY_LABEL, type HelpdeskOptions } from "./types";

const NONE = "none";

/**
 * Raise a ticket in CGB Helpdesk from the portal. The choices — categories,
 * sub categories, the person's own assets — come from the helpdesk, so this
 * form offers exactly what its own New Ticket form does. The ticket is the
 * person's there; IT works it there, and the replies show here too.
 */
export function RaiseHelpdeskTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: options, error: loadError, isLoading } = useApiQuery<HelpdeskOptions>(
    open ? "/products/helpdesk/ticket-options" : null,
  );
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState(NONE);
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const subCategories = options?.categories.find((item) => item.name === category)?.sub_categories ?? [];

  const reset = () => {
    setCategory("");
    setSubCategory("");
    setPriority("medium");
    setSubject("");
    setDescription("");
    setAssetId(NONE);
    setLocation("");
    setContact(null);
    setLink("");
    setError(null);
  };

  const save = async () => {
    if (!category) return setError("Choose what the ticket is about.");
    if (subject.trim().length < 3) return setError("Give the ticket a subject.");
    setError(null);
    setIsSaving(true);
    try {
      const phone = (contact ?? options?.contact ?? "").trim();
      const created = await post<{ ticket: { ref: string }; page: string }>("/products/helpdesk/tickets", {
        subject: subject.trim(),
        description: description.trim() || null,
        category,
        sub_category: subCategory || null,
        priority,
        location: location.trim() || null,
        contact: phone || null,
        link: link.trim() || null,
        asset_id: assetId === NONE ? null : assetId,
      });
      toast.success(`Ticket #${created.ticket.ref} raised`, {
        description: "The IT team picks it up in CGB Helpdesk. Replies show on the ticket here.",
      });
      setOpen(false);
      reset();
      router.push(created.page);
    } catch (caught) {
      setError(errorDetail(caught, "Could not raise the ticket."));
    } finally {
      setIsSaving(false);
    }
  };

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
        <Button>
          <Plus /> Raise a ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a ticket</DialogTitle>
          <DialogDescription>
            For IT: a laptop that won&apos;t start, VPN access, a new software licence. It goes to CGB Helpdesk.
          </DialogDescription>
        </DialogHeader>
        {isLoading && !options ? (
          <Skeleton className="h-72 w-full" />
        ) : loadError ? (
          <InlineError>{loadError.detail}</InlineError>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="hd-category" label="Category" required>
                <Select
                  value={category}
                  onValueChange={(next) => {
                    setCategory(next);
                    setSubCategory("");
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger id="hd-category" className="w-full">
                    <SelectValue placeholder="What is it about?" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.categories ?? []).map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="hd-sub-category" label="Sub category" optional>
                <Select value={subCategory} onValueChange={setSubCategory} disabled={isSaving || !category}>
                  <SelectTrigger id="hd-sub-category" className="w-full">
                    <SelectValue placeholder={category ? "Choose one" : "Choose a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="hd-priority" label="Priority" required>
                <Select value={priority} onValueChange={setPriority} disabled={isSaving}>
                  <SelectTrigger id="hd-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.priorities ?? ["low", "medium", "high"]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PRIORITY_LABEL[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="hd-asset" label="Device" optional hint="If it is about an asset you hold.">
                <Select value={assetId} onValueChange={setAssetId} disabled={isSaving}>
                  <SelectTrigger id="hd-asset" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not about a device</SelectItem>
                    {(options?.assets ?? []).map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.code} · {asset.type}
                        {asset.model ? ` (${asset.model})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField htmlFor="hd-subject" label="Subject" required>
              <Input
                id="hd-subject"
                value={subject}
                maxLength={200}
                disabled={isSaving}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Laptop doesn't connect to the office Wi-Fi"
              />
            </FormField>
            <FormField htmlFor="hd-description" label="Description" optional>
              <Textarea
                id="hd-description"
                rows={4}
                maxLength={5000}
                value={description}
                disabled={isSaving}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What happens, since when, and what you have tried."
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="hd-location" label="Location" optional>
                <Input
                  id="hd-location"
                  value={location}
                  maxLength={200}
                  disabled={isSaving}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Office, floor or desk"
                />
              </FormField>
              <FormField htmlFor="hd-contact" label="Contact number" optional>
                <Input
                  id="hd-contact"
                  value={contact ?? options?.contact ?? ""}
                  maxLength={30}
                  inputMode="tel"
                  disabled={isSaving}
                  onChange={(event) => setContact(event.target.value)}
                />
              </FormField>
            </div>
            <FormField
              htmlFor="hd-link"
              label="Reference link"
              optional
              hint="A screenshot, document or page that shows the problem. Add files in CGB Helpdesk."
            >
              <Input
                id="hd-link"
                type="url"
                value={link}
                maxLength={500}
                disabled={isSaving}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://"
              />
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
        )}
      </DialogContent>
    </Dialog>
  );
}

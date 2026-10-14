"use client";

import { Loader2, Plus, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, put } from "@/lib/api";

/**
 * A candidate's tags, edited in place. The API normalises them (lower case,
 * no duplicates) and its version is what is shown after each save.
 */
export function CandidateTagsEditor({ candidateId, initial }: { candidateId: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async (next: string[]) => {
    setIsSaving(true);
    try {
      const result = await put<{ tags: string[] }>(`/hiring/candidates/${candidateId}/tags`, { tags: next });
      setTags(result.tags);
      setDraft("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The tags could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    void save([...tags, ...value.split(",").map((part) => part.trim()).filter(Boolean)]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <Button
            variant="ghost"
            size="icon"
            className="size-4 rounded-full"
            aria-label={`Remove tag ${tag}`}
            disabled={isSaving}
            onClick={() => void save(tags.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </Button>
        </Badge>
      ))}
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Input
          aria-label="Add a tag"
          placeholder={tags.length ? "Add tag" : "Add tags, e.g. java, campus-2026"}
          className="h-7 w-44 text-xs"
          maxLength={120}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" variant="ghost" className="h-7" disabled={isSaving || !draft.trim()} aria-label="Save tag">
          {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
        </Button>
      </form>
    </div>
  );
}

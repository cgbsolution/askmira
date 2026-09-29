"use client";

import { Loader2, Lock, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Club, ClubMember } from "@/lib/types/culture";
import { formatDate } from "@/lib/utils";

import { apiDetail } from "./cultureShared";

/**
 * Culture → Clubs.
 *
 * Interest groups people start and join themselves. A private club's members
 * are visible only to its members; HR sees participation in aggregate, never
 * who joined what — being in the LGBTQ+ network or the faith group is not
 * something an employer gets to list.
 */
export function ClubsScreen() {
  const { user } = useAuth();
  const { data, error, isLoading, reload, setData } = useApiQuery<Club[]>("/culture/clubs");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Club | null>(null);
  const [leaving, setLeaving] = useState<Club | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const clubs = useMemo(
    () => (data ?? []).filter((club) => filter === "all" || club.is_member),
    [data, filter],
  );

  const replace = (updated: Club) =>
    setData((current) => (current ?? []).map((row) => (row.id === updated.id ? updated : row)));

  const join = async (club: Club) => {
    setBusy(club.id);
    try {
      replace(await post<Club>(`/culture/clubs/${club.id}/join`));
      toast.success(`You joined ${club.name}.`);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not join."));
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    if (!leaving) return;
    try {
      const updated = await post<Club | null>(`/culture/clubs/${leaving.id}/leave`);
      if (updated) {
        replace(updated);
        toast.success(`You left ${leaving.name}.`);
      } else {
        reload();
        toast.success(`You were the last member, so ${leaving.name} has closed.`);
      }
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not leave."));
      throw caught;
    }
  };

  const canJoin = Boolean(user?.employee_id);

  return (
    <PageShell
      tier="tier2"
      title="Clubs"
      description="Groups people start around what they care about outside the job description."
      actions={
        canJoin ? (
          <Button onClick={() => setCreating(true)}>
            <Plus /> Start a club
          </Button>
        ) : undefined
      }
    >
      <Tabs value={filter} onValueChange={(next) => setFilter(next as "all" | "mine")}>
        <TabsList>
          <TabsTrigger value="all">All clubs</TabsTrigger>
          <TabsTrigger value="mine">My clubs</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-44 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : clubs.length === 0 ? (
        <EmptyState
          tier="tier2"
          icon={Users}
          title={filter === "mine" ? "You have not joined a club yet" : "No clubs yet"}
          description={filter === "mine" ? "Browse all clubs to find one." : "Start the first one."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clubs.map((club) => (
            <Card key={club.id} tier="tier2" className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {club.icon && <span aria-hidden>{club.icon}</span>}
                  <span className="truncate">{club.name}</span>
                  {club.is_private && <Lock className="size-3.5 text-muted-foreground" aria-label="Private" />}
                </CardTitle>
                <CardDescription>
                  {club.member_count} member{club.member_count === 1 ? "" : "s"}
                  {club.is_member && club.my_role && ` · you are ${club.my_role}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {club.description || "No description yet."}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                {club.is_member ? (
                  <>
                    <Badge variant="secondary">Member</Badge>
                    <Button variant="outline" size="sm" onClick={() => setViewing(club)}>
                      Members
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLeaving(club)}>
                      Leave
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" disabled={!canJoin || busy === club.id} onClick={() => join(club)}>
                      {busy === club.id && <Loader2 className="animate-spin" />} Join
                    </Button>
                    {!club.is_private && (
                      <Button variant="outline" size="sm" onClick={() => setViewing(club)}>
                        Members
                      </Button>
                    )}
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <NewClubDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
      <MembersSheet club={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => !open && setLeaving(null)}
        title={`Leave ${leaving?.name ?? ""}?`}
        description={
          leaving?.member_count === 1
            ? "You are the only member, so the club closes when you leave."
            : "You can join again later."
        }
        confirmLabel="Leave club"
        onConfirm={leave}
      />
    </PageShell>
  );
}

function MembersSheet({ club, onOpenChange }: { club: Club | null; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ClubMember[]>(
    club ? `/culture/clubs/${club.id}/members` : null,
  );

  return (
    <Sheet open={club !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{club?.name}</SheetTitle>
          <SheetDescription>
            {club?.is_private ? "A private club — only members see who is in it." : "Everyone in the club."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : (
            <ul className="divide-y divide-border">
              {(data ?? []).map((member) => (
                <li key={member.employee_id} className="flex items-center justify-between gap-3 py-3">
                  <PersonCell
                    name={member.name}
                    photoUrl={member.photo_url}
                    subtitle={member.designation}
                    size="sm"
                  />
                  <div className="text-right">
                    {member.role !== "member" && <Badge variant="outline">{member.role}</Badge>}
                    <div className="text-xs text-muted-foreground">since {formatDate(member.joined_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NewClubDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setIcon("");
      setIsPrivate(false);
    }
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/culture/clubs", {
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        is_private: isPrivate,
      });
      toast.success("Club started. You are its first member.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not start the club."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a club</DialogTitle>
          <DialogDescription>You become its first member and its organiser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <FormField htmlFor="club-name" label="Name">
              <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend trekkers" />
            </FormField>
            <FormField htmlFor="club-icon" label="Emoji" optional>
              <Input id="club-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} placeholder="🥾" />
            </FormField>
          </div>
          <FormField htmlFor="club-description" label="What it is about" optional>
            <Textarea id="club-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </FormField>
          <div className="flex items-start gap-3">
            <Switch id="club-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
            <Label htmlFor="club-private" className="text-sm font-normal">
              Private — the club is listed, but only members can see who is in it.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || name.trim().length < 2}>
            {isBusy && <Loader2 className="animate-spin" />} Start club
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { EventPrivacy } from "@/lib/types/culture";

import { apiDetail } from "./cultureShared";

/**
 * Whether *my* birthday and work anniversary appear on the feed.
 *
 * Both are off until the person turns them on: a date of birth is personal
 * data, and a celebration nobody asked for is not a kindness.
 */
export function CelebrationPrivacyCard() {
  const { data, reload } = useApiQuery<EventPrivacy>("/culture/event-privacy");
  const [values, setValues] = useState<EventPrivacy | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  if (!values) return null;

  const dirty =
    data !== null &&
    (values.share_birthday !== data.share_birthday ||
      values.share_work_anniversary !== data.share_work_anniversary ||
      values.birthday_scope !== data.birthday_scope);

  const save = async () => {
    setIsBusy(true);
    try {
      await put("/culture/event-privacy", {
        share_birthday: values.share_birthday,
        share_work_anniversary: values.share_work_anniversary,
        birthday_scope: values.birthday_scope,
      });
      toast.success("Saved.");
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not save."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier2" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> My celebrations
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!values.configured && (
          <p className="text-xs text-muted-foreground">
            Nothing about you is shared until you switch it on here.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="share-birthday" className="text-sm font-normal">
            Share my birthday
          </Label>
          <Switch
            id="share-birthday"
            checked={values.share_birthday}
            onCheckedChange={(next) => setValues({ ...values, share_birthday: next })}
          />
        </div>
        {values.share_birthday && (
          <Select
            value={values.birthday_scope}
            onValueChange={(next) => setValues({ ...values, birthday_scope: next as "team" | "company" })}
          >
            <SelectTrigger aria-label="Who sees my birthday" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">My department only</SelectItem>
              <SelectItem value="company">Everyone</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="share-anniversary" className="text-sm font-normal">
            Share my work anniversary
          </Label>
          <Switch
            id="share-anniversary"
            checked={values.share_work_anniversary}
            onCheckedChange={(next) => setValues({ ...values, share_work_anniversary: next })}
          />
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />} Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

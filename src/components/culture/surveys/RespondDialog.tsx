"use client";

import { Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { MySurvey } from "@/lib/types/culture";
import { cn } from "@/lib/utils";

import { apiDetail } from "../cultureShared";

/**
 * Answer a survey.
 *
 * Every question uses the instrument's own scale, shown as a row of buttons so
 * a person on a phone can answer with a thumb. Free text is optional and
 * flagged as the one part that could identify somebody by how they write.
 */
export function RespondDialog({
  survey,
  onOpenChange,
  onDone,
}: {
  survey: MySurvey | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [freeText, setFreeText] = useState("");
  const [aiOk, setAiOk] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (survey) {
      setAnswers({});
      setFreeText("");
      setAiOk(false);
    }
  }, [survey]);

  const instrument = survey?.instrument;
  const [low, high] = instrument?.bounds ?? [1, 5];
  const scale = Array.from({ length: high - low + 1 }, (_, index) => low + index);
  const complete = instrument ? instrument.items.every((item) => answers[item.key] !== undefined) : false;

  const submit = async () => {
    if (!survey) return;
    setIsBusy(true);
    try {
      await post(`/culture/surveys/${survey.id}/responses`, {
        answers,
        free_text: freeText.trim() || null,
        comment_ai_ok: Boolean(freeText.trim()) && aiOk,
      });
      toast.success("Thank you. Your answers were recorded without your name.");
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Your answers were not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={survey !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{survey?.name}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Anonymous. {instrument?.scale}
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-5">
          {(instrument?.items ?? []).map((item, index) => (
            <li key={item.key} className="grid gap-2">
              <p className="text-sm text-foreground">
                <span className="mr-1 text-muted-foreground tabular-nums">{index + 1}.</span>
                {item.text}
              </p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={item.text}>
                {scale.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={answers[item.key] === value ? "default" : "outline"}
                    role="radio"
                    aria-checked={answers[item.key] === value}
                    className={cn("min-w-9 tabular-nums")}
                    onClick={() => setAnswers({ ...answers, [item.key]: value })}
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{low} — least</span>
                <span>{high} — most</span>
              </div>
            </li>
          ))}
        </ol>

        <FormField
          htmlFor="survey-free-text"
          label="Anything else"
          optional
          hint="Free text is stored without your name too, but a distinctive phrase can still identify its writer in a small team."
        >
          <Textarea id="survey-free-text" value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={3} />
        </FormField>
        {freeText.trim() && (
          <div className="flex items-start gap-2">
            <Checkbox id="survey-ai-ok" checked={aiOk} onCheckedChange={(on) => setAiOk(on === true)} />
            <Label htmlFor="survey-ai-ok" className="text-sm font-normal text-muted-foreground">
              AI may read this comment to summarise the survey&apos;s themes for HR. It goes without your name, nobody is
              told whether you ticked this, and it is never quoted.
            </Label>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Taking part is your choice. Submitting records that you agree to culture surveys; you can say no at any time
          under My privacy, and you will not be sent surveys after that.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Not now
          </Button>
          <Button onClick={submit} disabled={isBusy || !complete}>
            {isBusy && <Loader2 className="animate-spin" />} Submit answers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

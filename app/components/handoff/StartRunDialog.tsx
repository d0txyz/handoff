import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { passToAgent } from "./shared";

/** Collects a runbook's start inputs, starts the run, and opens it. */
export function StartRunDialog({
  runbookId,
  onClose,
}: {
  runbookId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const runbook = useActionQuery(
    "get-runbook",
    { id: runbookId ?? "" },
    { enabled: Boolean(runbookId) },
  );

  useEffect(() => {
    setTitle("");
    setValues({});
  }, [runbookId]);

  const start = useActionMutation("start-run", {
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not start the run."),
    onSuccess: (result) => {
      onClose();
      navigate(`/runs/${result.id}`);
      if (result.waitingOn === "agent") {
        passToAgent(
          `Start working the run "${result.title}": do your steps and stop when one waits on me.`,
          { runId: result.id },
        );
      }
    },
  });

  const data = runbookId ? runbook.data : undefined;

  return (
    <Dialog open={Boolean(runbookId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data ? `Start: ${data.title}` : "Start a run"}</DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const inputs: Record<string, string> = {};
              for (const def of data.inputs) {
                const value = values[def.key]?.trim();
                if (value) inputs[def.key] = value;
              }
              start.mutate({
                runbookId: data.id,
                ...(title.trim() ? { title: title.trim() } : {}),
                inputs,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="run-title">Name this run</Label>
              <Input
                id="run-title"
                value={title}
                maxLength={140}
                placeholder={data.title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            {data.inputs.map((def) => (
              <div key={def.key} className="space-y-1.5">
                <Label htmlFor={`input-${def.key}`}>{def.label}</Label>
                {def.multiline ? (
                  <Textarea
                    id={`input-${def.key}`}
                    rows={4}
                    value={values[def.key] ?? ""}
                    placeholder={def.placeholder}
                    onChange={(event) =>
                      setValues((old) => ({
                        ...old,
                        [def.key]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    id={`input-${def.key}`}
                    value={values[def.key] ?? ""}
                    placeholder={def.placeholder}
                    onChange={(event) =>
                      setValues((old) => ({
                        ...old,
                        [def.key]: event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={start.isPending}>
                {start.isPending ? "Starting" : "Start run"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconRobot,
  IconSparkles,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import type { Owner } from "@/components/handoff/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Runbook, Handoff" }];
}

interface DraftStep {
  uid: string;
  title: string;
  instructions: string;
  owner: Owner;
  needsApproval: boolean;
}

interface DraftInput {
  uid: string;
  key: string;
  label: string;
  placeholder: string;
  multiline: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function keyFor(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "x$1") || "input";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

function OwnerToggle({
  owner,
  onChange,
}: {
  owner: Owner;
  onChange: (owner: Owner) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Who does this step"
      className="inline-flex shrink-0 rounded-lg border border-border p-0.5"
    >
      {(["me", "agent"] as const).map((value) => {
        const Icon = value === "agent" ? IconRobot : IconUser;
        const selected = owner === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? value === "agent"
                  ? "lane-agent-bg"
                  : "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} />
            {value === "agent" ? "Agent" : "You"}
          </button>
        );
      })}
    </div>
  );
}

export default function RunbookRoute() {
  const { runbookId = "new" } = useParams();
  const isNew = runbookId === "new";
  const navigate = useNavigate();
  const existing = useActionQuery(
    "get-runbook",
    { id: runbookId },
    { enabled: !isNew },
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inputs, setInputs] = useState<DraftInput[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([
    { uid: uid(), title: "", instructions: "", owner: "agent", needsApproval: true },
  ]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reload the form whenever the saved runbook changes, including when the
  // agent rewrites it from the sidebar.
  const loaded = existing.data;
  useEffect(() => {
    if (!loaded) return;
    setTitle(loaded.title);
    setDescription(loaded.description);
    setInputs(
      loaded.inputs.map((input) => ({
        uid: uid(),
        key: input.key,
        label: input.label,
        placeholder: input.placeholder ?? "",
        multiline: Boolean(input.multiline),
      })),
    );
    setSteps(
      loaded.steps.map((step) => ({
        uid: step.id,
        title: step.title,
        instructions: step.instructions,
        owner: step.owner,
        needsApproval: step.needsApproval,
      })),
    );
  }, [loaded]);

  const save = useActionMutation("save-runbook", {
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not save the runbook."),
    onSuccess: (result) => {
      toast.success("Saved");
      if (isNew) navigate(`/runbooks/${result.id}`, { replace: true });
    },
  });
  const remove = useActionMutation("delete-runbook", {
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not delete the runbook."),
    onSuccess: () => navigate("/runs"),
  });

  function patchStep(id: string, patch: Partial<DraftStep>) {
    setSteps((old) =>
      old.map((step) => (step.uid === id ? { ...step, ...patch } : step)),
    );
  }
  function moveStep(index: number, delta: number) {
    setSteps((old) => {
      const next = [...old];
      const target = index + delta;
      if (target < 0 || target >= next.length) return old;
      const moved = next[index];
      const swapped = next[target];
      if (!moved || !swapped) return old;
      next[index] = swapped;
      next[target] = moved;
      return next;
    });
  }
  function patchInput(id: string, patch: Partial<DraftInput>) {
    setInputs((old) =>
      old.map((input) => (input.uid === id ? { ...input, ...patch } : input)),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanSteps = steps.filter((step) => step.title.trim());
    if (!title.trim() || !cleanSteps.length) {
      toast.error("Give the runbook a name and at least one step.");
      return;
    }
    const taken = new Set(inputs.map((input) => input.key).filter(Boolean));
    save.mutate({
      ...(isNew ? {} : { id: runbookId }),
      title: title.trim(),
      description: description.trim(),
      inputs: inputs
        .filter((input) => input.label.trim())
        .map((input) => ({
          key: input.key || keyFor(input.label, taken),
          label: input.label.trim(),
          ...(input.placeholder.trim()
            ? { placeholder: input.placeholder.trim() }
            : {}),
          multiline: input.multiline,
        })),
      steps: cleanSteps.map((step) => ({
        title: step.title.trim(),
        instructions: step.instructions.trim(),
        owner: step.owner,
        needsApproval: step.owner === "agent" && step.needsApproval,
      })),
    });
  }

  if (!isNew && existing.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!isNew && existing.error) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          {actionErrorMessage(existing.error) ?? "Runbook not found."}
        </p>
        <Link className="mt-3 inline-block text-sm underline" to="/runs">
          Back to runs
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/runs"
          className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconArrowLeft className="size-3.5" />
          Runs
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              sendToAgentChat({
                message: isNew
                  ? "Create a runbook for this process. Decide which steps are mine and which are yours.\n\nThe process: "
                  : "Improve this runbook: ",
                ...(isNew ? {} : { context: JSON.stringify({ runbookId }) }),
                submit: false,
                openSidebar: true,
              })
            }
          >
            <IconSparkles className="size-4" />
            {isNew ? "Draft with agent" : "Improve with agent"}
          </Button>
          {!isNew ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete runbook"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash className="size-4" />
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          value={title}
          maxLength={120}
          aria-label="Runbook name"
          placeholder="Runbook name"
          className="h-11 text-lg font-semibold"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          value={description}
          aria-label="When to run this"
          placeholder="When do you run this? (optional)"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <section className="mt-8" aria-labelledby="steps-heading">
        <h2
          id="steps-heading"
          className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Steps
        </h2>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.uid}
              className={cn(
                "rounded-xl border bg-card p-4",
                step.owner === "agent" ? "lane-agent-border" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-5 text-sm font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <OwnerToggle
                  owner={step.owner}
                  onChange={(owner) => patchStep(step.uid, { owner })}
                />
                <Input
                  value={step.title}
                  maxLength={140}
                  aria-label={`Step ${index + 1} title`}
                  placeholder="What happens in this step"
                  className="min-w-40 flex-1"
                  onChange={(event) =>
                    patchStep(step.uid, { title: event.target.value })
                  }
                />
                <span className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move step up"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    <IconChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move step down"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    <IconChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove step"
                    disabled={steps.length === 1}
                    onClick={() =>
                      setSteps((old) =>
                        old.filter((item) => item.uid !== step.uid),
                      )
                    }
                  >
                    <IconX className="size-4" />
                  </Button>
                </span>
              </div>
              <Textarea
                rows={2}
                value={step.instructions}
                aria-label={`Step ${index + 1} instructions`}
                placeholder={
                  step.owner === "agent"
                    ? "What should the agent produce, and from what?"
                    : "What do you need to do?"
                }
                className="mt-3"
                onChange={(event) =>
                  patchStep(step.uid, { instructions: event.target.value })
                }
              />
              {step.owner === "agent" ? (
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    id={`gate-${step.uid}`}
                    checked={step.needsApproval}
                    onCheckedChange={(needsApproval) =>
                      patchStep(step.uid, { needsApproval })
                    }
                  />
                  <Label htmlFor={`gate-${step.uid}`} className="text-sm">
                    I approve this before the run moves on
                  </Label>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            setSteps((old) => [
              ...old,
              {
                uid: uid(),
                title: "",
                instructions: "",
                owner: "me",
                needsApproval: false,
              },
            ])
          }
        >
          <IconPlus className="size-4" />
          Add step
        </Button>
      </section>

      <section className="mt-8" aria-labelledby="inputs-heading">
        <h2
          id="inputs-heading"
          className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Asked at the start of each run
        </h2>
        <ul className="space-y-2">
          {inputs.map((input) => (
            <li key={input.uid} className="flex flex-wrap items-center gap-2">
              <Input
                value={input.label}
                aria-label="Question label"
                placeholder="Client name"
                className="min-w-40 flex-1"
                onChange={(event) =>
                  patchInput(input.uid, { label: event.target.value })
                }
              />
              <Input
                value={input.placeholder}
                aria-label="Example answer"
                placeholder="Example answer (optional)"
                className="min-w-40 flex-1"
                onChange={(event) =>
                  patchInput(input.uid, { placeholder: event.target.value })
                }
              />
              <span className="flex items-center gap-2">
                <Switch
                  id={`long-${input.uid}`}
                  checked={input.multiline}
                  onCheckedChange={(multiline) =>
                    patchInput(input.uid, { multiline })
                  }
                />
                <Label htmlFor={`long-${input.uid}`} className="text-xs">
                  Long text
                </Label>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove question"
                onClick={() =>
                  setInputs((old) =>
                    old.filter((item) => item.uid !== input.uid),
                  )
                }
              >
                <IconX className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={inputs.length >= 8}
          onClick={() =>
            setInputs((old) => [
              ...old,
              { uid: uid(), key: "", label: "", placeholder: "", multiline: false },
            ])
          }
        >
          <IconPlus className="size-4" />
          Add question
        </Button>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this runbook?</AlertDialogTitle>
            <AlertDialogDescription>
              Runs you already started from it are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: runbookId })}
            >
              Delete runbook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

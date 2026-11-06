import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowLeft,
  IconArrowsExchange,
  IconCheck,
  IconCopy,
  IconDots,
  IconPencil,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconRobot,
  IconUser,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  isClosed,
  Markdown,
  OwnerChip,
  passToAgent,
  timeAgo,
  type Owner,
  type StepStatus,
} from "@/components/handoff/shared";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  position: number;
  title: string;
  instructions: string;
  owner: Owner;
  needsApproval: boolean;
  status: StepStatus;
  output: string;
  feedback: string;
  completedBy: Owner | null;
  updatedAt: string;
}

const ROW = 60;
const LANE_X: Record<Owner, number> = { me: 24, agent: 72 };

function statusLine(step: Step, isCurrent: boolean): string {
  if (step.status === "done") {
    if (step.completedBy === "agent") {
      return step.needsApproval ? "Agent, approved by you" : "Done by the agent";
    }
    return "Done by you";
  }
  if (step.status === "skipped") return "Skipped";
  if (step.status === "review") return "Waiting for your review";
  if (step.status === "changes") return "Agent is revising";
  if (!isCurrent) return step.owner === "agent" ? "Agent, up later" : "You, up later";
  return step.owner === "agent" ? "Agent's move" : "Your move";
}

/** The two lanes, with a line that crosses over at every handoff. */
function LaneRail({
  steps,
  currentId,
  selectedId,
  active,
  onSelect,
  onHandoff,
}: {
  steps: Step[];
  currentId: string | null;
  selectedId: string | null;
  active: boolean;
  onSelect: (id: string) => void;
  onHandoff: (step: Step, owner: Owner) => void;
}) {
  return (
    <div>
      <div className="flex h-7 items-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="w-12 text-center">You</span>
        <span className="lane-agent-text w-12 text-center">Agent</span>
      </div>
      <ol className="relative" style={{ height: steps.length * ROW }}>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0"
          width={96}
          height={steps.length * ROW}
        >
          {steps.slice(0, -1).map((step, index) => {
            const next = steps[index + 1];
            if (!next) return null;
            const x1 = LANE_X[step.owner];
            const x2 = LANE_X[next.owner];
            const y1 = index * ROW + ROW / 2;
            const y2 = y1 + ROW;
            const mid = (y1 + y2) / 2;
            return (
              <path
                key={step.id}
                d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={isClosed(step.status) ? undefined : "2 5"}
                className={
                  isClosed(step.status)
                    ? "stroke-foreground/50"
                    : "stroke-foreground/25"
                }
              />
            );
          })}
        </svg>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentId;
          const closed = isClosed(step.status);
          const agent = step.owner === "agent";
          const other: Owner = agent ? "me" : "agent";
          const canHandoff = active && !closed;
          return (
            <li
              key={step.id}
              className={cn(
                "group absolute inset-x-0 rounded-lg transition-colors",
                step.id === selectedId ? "bg-accent" : "hover:bg-accent/50",
              )}
              style={{ top: index * ROW, height: ROW }}
            >
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={step.id === selectedId ? "step" : undefined}
                className="absolute inset-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    step.status === "done" &&
                      (step.completedBy === "agent" || (agent && !step.completedBy)
                        ? "lane-agent-bg lane-agent-border"
                        : "border-foreground bg-foreground text-background"),
                    step.status === "skipped" &&
                      "border-border bg-background text-muted-foreground",
                    !closed &&
                      (agent
                        ? "lane-agent-border lane-agent-text bg-background"
                        : "border-foreground bg-background text-foreground"),
                    !closed && !isCurrent && "opacity-45",
                    isCurrent &&
                      active &&
                      agent &&
                      step.status !== "review" &&
                      "handoff-node-live",
                  )}
                  style={{ left: LANE_X[step.owner] }}
                >
                  {step.status === "done" ? (
                    <IconCheck className="size-3.5" strokeWidth={3} />
                  ) : (
                    step.position
                  )}
                </span>
                <span className="absolute inset-y-0 left-[108px] right-2 flex flex-col justify-center">
                  <span
                    className={cn(
                      "truncate text-sm",
                      isCurrent
                        ? "font-semibold text-foreground"
                        : closed
                          ? "text-muted-foreground"
                          : "text-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs",
                      step.status === "review"
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {statusLine(step, isCurrent)}
                  </span>
                </span>
              </button>
              {canHandoff ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onHandoff(step, other)}
                      aria-label={
                        other === "agent"
                          ? `Hand step ${step.position} to the agent`
                          : `Take over step ${step.position}`
                      }
                      className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                      style={{ left: LANE_X[other] }}
                    >
                      <span
                        className={cn(
                          "size-3 rounded-full border-2 border-dashed",
                          other === "agent"
                            ? "lane-agent-border"
                            : "border-foreground",
                        )}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {other === "agent" ? "Hand to agent" : "Take over"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function RunRoute() {
  const { runId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: run, isPending, error } = useActionQuery("get-run", {
    id: runId,
  });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [askingChanges, setAskingChanges] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);

  const steps = (run?.steps ?? []) as Step[];
  const active = run?.status === "active";
  const currentId = run?.currentStepId ?? null;
  const selectedId =
    steps.find((step) => step.id === searchParams.get("step"))?.id ??
    currentId ??
    steps[steps.length - 1]?.id ??
    null;
  const step = steps.find((candidate) => candidate.id === selectedId) ?? null;
  const current = steps.find((candidate) => candidate.id === currentId) ?? null;

  useEffect(() => {
    setDraft(step?.output ?? "");
    setEditing(false);
    setNotes("");
    setFeedback("");
    setAskingChanges(false);
  }, [step?.id, step?.updatedAt, step?.output]);

  const context = { runId };
  const onError = (fallback: string) => (failure: unknown) =>
    toast.error(actionErrorMessage(failure) ?? fallback);

  /** After the person closes a step, the baton goes to the agent if it is next. */
  function afterMine(result: {
    next?: { waitingOn: Owner | null; id: string } | null;
    runStatus?: string;
  }) {
    if (result.runStatus === "done") {
      toast.success("Run complete");
      return;
    }
    if (result.next?.waitingOn === "agent") {
      passToAgent(
        `Continue the run "${run?.title}": do your next steps and stop when one waits on me.`,
        context,
      );
    }
    setSearchParams({}, { replace: true });
  }

  const submit = useActionMutation("submit-step", {
    onError: onError("Could not finish the step."),
    onSuccess: afterMine,
  });
  const approve = useActionMutation("approve-step", {
    onError: onError("Could not approve."),
    onSuccess: afterMine,
  });
  const skip = useActionMutation("skip-step", {
    onError: onError("Could not skip."),
    onSuccess: afterMine,
  });
  const requestChanges = useActionMutation("request-changes", {
    onError: onError("Could not send it back."),
    onSuccess: (_result, input) => {
      const target = steps.find((candidate) => candidate.id === input.id);
      passToAgent(
        `Revise step ${target?.position} "${target?.title}" using my feedback, then submit it again.`,
        { ...context, stepId: input.id },
      );
    },
  });
  const assign = useActionMutation("assign-step", {
    onError: onError("Could not hand off the step."),
    onSuccess: (result) => {
      if (result.owner === "agent" && result.id === currentId) {
        passToAgent(
          `I handed you the current step of the run "${run?.title}". Do it, then keep going until a step waits on me.`,
          context,
        );
      }
    },
  });
  const cancel = useActionMutation("cancel-run", {
    onError: onError("Could not update the run."),
    onSuccess: (result) => {
      setConfirm(null);
      if (result.status === "deleted") navigate("/runs");
    },
  });

  if (isPending) {
    return (
      <div className="@container mx-auto w-full max-w-6xl px-4 py-8 sm:px-8"><div className="grid gap-8 @4xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div></div>
    );
  }
  if (error || !run) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          {actionErrorMessage(error) ?? "Run not found."}
        </p>
        <Link className="mt-3 inline-block text-sm underline" to="/runs">
          Back to runs
        </Link>
      </div>
    );
  }

  const busy =
    submit.isPending ||
    approve.isPending ||
    skip.isPending ||
    requestChanges.isPending ||
    assign.isPending;
  const isCurrent = Boolean(step && step.id === currentId);
  const stepOpen = Boolean(step && !isClosed(step.status));
  const runAgent = () =>
    passToAgent(
      `Work the run "${run.title}": do your current step and keep going until a step waits on me.`,
      context,
    );

  return (
    <div className="@container mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/runs"
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconArrowLeft className="size-3.5" />
            Runs
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
            {run.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {run.status !== "active" ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {run.status === "done" ? "Complete" : "Cancelled"}
            </span>
          ) : current ? (
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                run.waitingOn === "me"
                  ? "bg-foreground text-background"
                  : "lane-agent-soft",
              )}
            >
              {run.waitingOn === "me"
                ? current.status === "review"
                  ? "Review needed"
                  : "Your move"
                : "Agent's move"}
              {`, step ${current.position} of ${run.total}`}
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Run options">
                <IconDots className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {active ? (
                <DropdownMenuItem onSelect={() => setConfirm("cancel")}>
                  Cancel run
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setConfirm("delete")}>
                Delete run
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-8 @4xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <LaneRail
            steps={steps}
            currentId={currentId}
            selectedId={selectedId}
            active={Boolean(active)}
            onSelect={(id) =>
              setSearchParams(id === currentId ? {} : { step: id }, {
                replace: true,
              })
            }
            onHandoff={(target, owner) =>
              assign.mutate({ id: target.id, owner })
            }
          />
          {run.inputs.some((input) => input.value) ? (
            <details className="mt-6 rounded-lg border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What this run started with
              </summary>
              <dl className="mt-3 space-y-3">
                {run.inputs
                  .filter((input) => input.value)
                  .map((input) => (
                    <div key={input.key}>
                      <dt className="text-xs text-muted-foreground">
                        {input.label}
                      </dt>
                      <dd className="whitespace-pre-line text-foreground">
                        {input.value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </details>
          ) : null}
        </aside>

        {step ? (
          <section
            aria-label={`Step ${step.position}`}
            className="min-w-0 rounded-xl border border-border bg-card"
          >
            <div className="border-b border-border p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Step {step.position}</span>
                <OwnerChip owner={step.owner} />
                {step.owner === "agent" && step.needsApproval ? (
                  <span>needs your approval</span>
                ) : null}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                {step.title}
              </h2>
              {step.instructions ? (
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {step.instructions}
                </p>
              ) : null}
            </div>

            <div className="space-y-4 p-5">
              {step.status === "changes" && step.feedback ? (
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    You asked for changes
                  </span>
                  <p className="mt-1 whitespace-pre-line text-foreground">
                    {step.feedback}
                  </p>
                </div>
              ) : null}

              {step.output ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {step.status === "review" ? "Agent's draft" : "Output"}
                    </span>
                    <span className="flex items-center gap-1">
                      {step.status === "review" && active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing((on) => !on)}
                        >
                          <IconPencil className="size-3.5" />
                          {editing ? "Preview" : "Edit"}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(editing ? draft : step.output)
                            .then(() => toast.success("Copied"));
                        }}
                      >
                        <IconCopy className="size-3.5" />
                        Copy
                      </Button>
                    </span>
                  </div>
                  {editing ? (
                    <Textarea
                      value={draft}
                      rows={14}
                      aria-label="Edit the draft"
                      className="font-mono text-sm"
                      onChange={(event) => setDraft(event.target.value)}
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <Markdown
                        content={step.status === "review" ? draft : step.output}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {!active || !stepOpen ? null : step.status === "review" ? (
                askingChanges ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!feedback.trim()) return;
                      requestChanges.mutate({
                        id: step.id,
                        feedback: feedback.trim(),
                      });
                    }}
                  >
                    <Textarea
                      autoFocus
                      rows={3}
                      value={feedback}
                      aria-label="What should change"
                      placeholder="What should change?"
                      onChange={(event) => setFeedback(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={busy || !feedback.trim()}>
                        Send back to agent
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAskingChanges(false)}
                      >
                        Never mind
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        approve.mutate({
                          id: step.id,
                          ...(draft.trim() !== step.output.trim()
                            ? { output: draft }
                            : {}),
                        })
                      }
                    >
                      <IconCheck className="size-4" />
                      {draft.trim() !== step.output.trim()
                        ? "Approve with my edits"
                        : "Approve"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setAskingChanges(true)}
                    >
                      Request changes
                    </Button>
                  </div>
                )
              ) : !isCurrent ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span>
                    Starts after step {current?.position}
                    {current ? `, "${current.title}"` : ""}.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      assign.mutate({
                        id: step.id,
                        owner: step.owner === "agent" ? "me" : "agent",
                      })
                    }
                  >
                    <IconArrowsExchange className="size-4" />
                    {step.owner === "agent" ? "I'll do this one" : "Hand to agent"}
                  </Button>
                </div>
              ) : step.owner === "agent" ? (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={runAgent}>
                    <IconPlayerPlay className="size-4" />
                    {step.status === "changes" ? "Ask agent to revise" : "Run agent"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => assign.mutate({ id: step.id, owner: "me" })}
                  >
                    <IconUser className="size-4" />
                    I'll do this one
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => skip.mutate({ id: step.id })}
                  >
                    <IconPlayerSkipForward className="size-4" />
                    Skip
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    rows={3}
                    value={notes}
                    aria-label="Notes for this step"
                    placeholder="Notes or results the agent should use later (optional)"
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        submit.mutate({
                          id: step.id,
                          ...(notes.trim() ? { output: notes.trim() } : {}),
                        })
                      }
                    >
                      <IconCheck className="size-4" />
                      Mark done
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        assign.mutate({ id: step.id, owner: "agent" })
                      }
                    >
                      <IconRobot className="size-4" />
                      Hand to agent
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => skip.mutate({ id: step.id })}
                    >
                      <IconPlayerSkipForward className="size-4" />
                      Skip
                    </Button>
                  </div>
                </div>
              )}

              {!step.output && !stepOpen ? (
                <p className="text-sm text-muted-foreground">
                  {step.status === "skipped"
                    ? "This step was skipped."
                    : "Done, with no notes."}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {run.events.length ? (
        <section className="mt-10" aria-labelledby="activity">
          <h2
            id="activity"
            className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Activity
          </h2>
          <ol className="space-y-2">
            {run.events.map((event) => (
              <li key={event.id} className="flex items-baseline gap-3 text-sm">
                <OwnerChip owner={event.actor} className="shrink-0" />
                <span className="min-w-0 flex-1 text-foreground">
                  {event.message}
                </span>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={event.createdAt}
                >
                  {timeAgo(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "Delete this run?" : "Cancel this run?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "The run, its outputs and its activity are removed for good."
                : "Open steps stop here. Finished work stays readable."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate({ id: run.id, remove: confirm === "delete" })
              }
            >
              {confirm === "delete" ? "Delete run" : "Cancel run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

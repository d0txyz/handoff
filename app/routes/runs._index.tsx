import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconChevronDown,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSparkles,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { LaneStrip, timeAgo } from "@/components/handoff/shared";
import { StartRunDialog } from "@/components/handoff/StartRunDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function describeProcess() {
  sendToAgentChat({
    message:
      "Create a runbook for this process. Decide which steps are mine and which are yours, and gate anything that goes to another person behind my approval.\n\nThe process: ",
    submit: false,
    openSidebar: true,
  });
}

export default function RunsIndexRoute() {
  const runs = useActionQuery("list-runs", { status: "all" });
  const runbooks = useActionQuery("list-runbooks", {});
  const [startId, setStartId] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const samples = useActionMutation("load-sample-runbooks", {
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not add the samples."),
  });

  const all = runs.data?.runs ?? [];
  const active = all
    .filter((run) => run.status === "active")
    .sort(
      (a, b) =>
        Number(b.waitingOn === "me") - Number(a.waitingOn === "me") ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const finished = all.filter((run) => run.status !== "active");
  const library = runbooks.data?.runbooks ?? [];
  const loading = runs.isPending || runbooks.isPending;

  return (
    <div className="@container mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 sm:px-8">
      <section aria-labelledby="in-progress">
        <h2
          id="in-progress"
          className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          In progress
        </h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Nothing is running. Start a runbook below and the agent picks up its
            steps as soon as the baton reaches it.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {active.map((run) => {
              const mine = run.waitingOn === "me";
              return (
                <li key={run.id}>
                  <Link
                    to={`/runs/${run.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {run.title}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <LaneStrip lanes={run.lanes} />
                        <span className="truncate">
                          {run.currentStep
                            ? `Step ${run.currentStep.position} of ${run.total}: ${run.currentStep.title}`
                            : `${run.total} steps`}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        mine
                          ? "bg-foreground text-background"
                          : "lane-agent-soft",
                      )}
                    >
                      {mine
                        ? run.currentStep?.status === "review"
                          ? "Review needed"
                          : "Your move"
                        : "Agent's move"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="runbooks">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="runbooks"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Runbooks
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={describeProcess}>
              <IconSparkles className="size-4" />
              Describe a process
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/runbooks/new">
                <IconPlus className="size-4" />
                New runbook
              </Link>
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="grid gap-3 @2xl:grid-cols-2">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : library.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              A runbook is a process split into steps, each owned by you or the
              agent.
            </p>
            <Button
              className="mt-4"
              disabled={samples.isPending}
              onClick={() => samples.mutate({})}
            >
              {samples.isPending ? "Adding" : "Add three sample runbooks"}
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3 @2xl:grid-cols-2">
            {library.map((runbook) => (
              <li
                key={runbook.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-semibold text-foreground">
                    {runbook.title}
                  </h3>
                  <Link
                    to={`/runbooks/${runbook.id}`}
                    aria-label={`Edit ${runbook.title}`}
                    className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <IconPencil className="size-4" />
                  </Link>
                </div>
                {runbook.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {runbook.description}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
                    <LaneStrip
                      lanes={runbook.lanes.map((owner) => ({ owner }))}
                    />
                    <span>
                      {runbook.stepCount - runbook.agentSteps} yours,{" "}
                      {runbook.agentSteps} agent
                    </span>
                  </span>
                  <Button size="sm" onClick={() => setStartId(runbook.id)}>
                    <IconPlayerPlay className="size-4" />
                    Start
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {finished.length ? (
        <section>
          <button
            type="button"
            onClick={() => setShowFinished((open) => !open)}
            aria-expanded={showFinished}
            className="flex items-center gap-1 rounded text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Finished ({finished.length})
            <IconChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showFinished && "rotate-180",
              )}
            />
          </button>
          {showFinished ? (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {finished.map((run) => (
                <li key={run.id}>
                  <Link
                    to={`/runs/${run.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="truncate text-foreground">{run.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {run.status === "done" ? "Done" : "Cancelled"}{" "}
                      {timeAgo(run.completedAt ?? run.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <StartRunDialog runbookId={startId} onClose={() => setStartId(null)} />
    </div>
  );
}

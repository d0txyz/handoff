import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconRobot, IconUser } from "@tabler/icons-react";
import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Owner = "me" | "agent";
export type StepStatus = "todo" | "review" | "changes" | "done" | "skipped";

export function isClosed(status: StepStatus) {
  return status === "done" || status === "skipped";
}

/** Hand work to the agent in the sidebar chat, with the ids it needs. */
export function passToAgent(message: string, context: Record<string, string>) {
  sendToAgentChat({
    message,
    context: JSON.stringify(context),
    submit: true,
    openSidebar: true,
  });
}

export function OwnerChip({
  owner,
  className,
}: {
  owner: Owner;
  className?: string;
}) {
  const Icon = owner === "agent" ? IconRobot : IconUser;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium",
        owner === "agent"
          ? "lane-agent-soft"
          : "bg-foreground/10 text-foreground",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2} />
      {owner === "agent" ? "Agent" : "You"}
    </span>
  );
}

/** One dot per step: ink for the person, baton colour for the agent. */
export function LaneStrip({
  lanes,
  className,
}: {
  lanes: { owner: Owner; status?: StepStatus }[];
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-hidden="true"
    >
      {lanes.map((lane, index) => {
        const open = lane.status ? !isClosed(lane.status) : false;
        return (
          <span
            key={index}
            className={cn(
              "h-1.5 w-4 rounded-full",
              lane.owner === "agent" ? "lane-agent-bg" : "bg-foreground",
              open && "opacity-25",
            )}
          />
        );
      })}
    </span>
  );
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/**
 * Small markdown view for step output: headings, lists, checkboxes, bold,
 * italic and code. Step output is plain text from the agent or the person,
 * so nothing here renders HTML.
 */
export function Markdown({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[][] = [];

  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const flush = () => {
    if (table.length) {
      const [head, ...body] = table;
      blocks.push(
        <div key={blocks.length} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {(head ?? []).map((cell, index) => (
                  <th
                    key={index}
                    className="border-b border-border px-2 py-1.5 font-semibold text-foreground"
                  >
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className="border-b border-border/60 px-2 py-1.5 align-top first:whitespace-nowrap"
                    >
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      table = [];
    }
    if (paragraph.length) {
      blocks.push(
        <p key={blocks.length} className="whitespace-pre-line">
          {inline(paragraph.join("\n"))}
        </p>,
      );
      paragraph = [];
    }
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length}>
          {list.items.map((item, index) => {
            const box = item.match(/^\[( |x|X)\]\s+(.*)$/);
            return (
              <li key={index} className={box ? "list-none -ms-5" : undefined}>
                {box ? (
                  <span className="inline-flex gap-2">
                    <span aria-hidden="true">{box[1] === " " ? "☐" : "☑"}</span>
                    <span>{inline(box[2] ?? "")}</span>
                  </span>
                ) : (
                  inline(item)
                )}
              </li>
            );
          })}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) {
      flush();
    } else if (line.trim().startsWith("|")) {
      if (paragraph.length || list) flush();
      const row = cells(line);
      const divider = row.every((cell) => /^:?-{2,}:?$/.test(cell));
      const empty = row.every((cell) => !cell);
      if (!divider && !empty) table.push(row);
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={blocks.length} className="my-3 border-border" />);
    } else if (heading) {
      flush();
      blocks.push(
        <p
          key={blocks.length}
          className={cn(
            "font-semibold text-foreground",
            (heading[1] ?? "").length <= 2 ? "mt-3 text-[0.95rem]" : "mt-2",
          )}
        >
          {inline(heading[2] ?? "")}
        </p>,
      );
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || table.length || (list && list.ordered !== ordered))
        flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? "");
    } else {
      if (list || table.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return <div className="handoff-prose">{blocks}</div>;
}

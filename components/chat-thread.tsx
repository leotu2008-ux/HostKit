"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HostyMark } from "@/components/hosty-mark";
import { relativeTime } from "@/lib/activity-format";
import type { ChatMessage, ChatSpeaker } from "@/lib/hosty-voice";
import { cx } from "@/components/ui";

/**
 * The Overview's feed as a chat with Hosty. Presentational: the caller owns
 * polling and passes messages oldest first. Consecutive messages from the
 * same speaker share one header; a note always stands alone.
 *
 * Scrolling sticks to the newest message only while the reader is already
 * near the bottom, so a poll never yanks them out of history they're reading.
 */

const STICK_PX = 80;

/** What the stick-to-bottom effect watches: the newest message's id. Not the
 *  count, because `mergeFeed` caps the feed at 100 rows, and past that a new
 *  message pushes the oldest out and the length never changes. */
export function scrollKey(messages: ChatMessage[]): string {
  return messages[messages.length - 1]?.id ?? "";
}

type Group = { speaker: ChatSpeaker; messages: ChatMessage[] };

function groupMessages(messages: ChatMessage[]): Group[] {
  const groups: Group[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === message.speaker && message.speaker !== "note") {
      last.messages.push(message);
    } else {
      groups.push({ speaker: message.speaker, messages: [message] });
    }
  }
  return groups;
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunk text-ink"
    >
      <HostyMark size={18} />
    </span>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.speaker === "you";
  return (
    <div
      className={cx(
        "max-w-[34rem] rounded-2xl px-3 py-2 text-[13.5px] leading-snug",
        mine ? "rounded-tr-md bg-brand text-white" : "rounded-tl-md bg-sunk text-ink",
      )}
    >
      {/* Every bubble, even under a group's "Hosty" header: the list is a
          live region, so a bubble appended to a group is announced alone. */}
      <span className="sr-only">{mine ? "You: " : "Hosty: "}</span>
      {message.text}
      {message.action ? (
        <div className="mt-2">
          <Link
            href={message.action.href}
            className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink hover:bg-sunk"
          >
            {message.action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Announced once, by the sr-only text: an aria-label on the `<li>` as well
 *  would make some screen readers say it twice. */
function Typing() {
  return (
    <li className="flex items-start gap-2.5">
      <Avatar />
      <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-sunk px-3 py-2.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-ink-mute"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">Hosty is typing</span>
    </li>
  );
}

export function ChatThread({
  messages,
  running,
  needsBrief,
  now,
  eventId,
}: {
  messages: ChatMessage[];
  running: boolean;
  /** Whether the brief still has missing fields. */
  needsBrief: boolean;
  now: Date;
  eventId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const newest = scrollKey(messages);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [newest, running]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  }

  // Notes alone still count as empty: every event starts with an
  // "Event created" note, so the invitation would otherwise never show.
  const shown: ChatMessage[] =
    needsBrief && !running && messages.every((message) => message.speaker === "note")
      ? [
          ...messages,
          {
            id: "hosty-empty",
            speaker: "hosty",
            text: "Fill in the brief and I'll get going.",
            action: { label: "Open the brief", href: `/events/${eventId}/brief` },
            createdAt: now.toISOString(),
          },
        ]
      : messages;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="max-h-[28rem] overflow-y-auto pr-1">
      <ol aria-live="polite" className="space-y-3">
        {groupMessages(shown).map((group) => {
          const first = group.messages[0];
          const last = group.messages[group.messages.length - 1];
          if (group.speaker === "note") {
            return (
              <li key={first.id} data-speaker="note" className="text-center text-[11px] text-ink-mute">
                {first.text} · {relativeTime(first.createdAt, now)}
              </li>
            );
          }
          if (group.speaker === "you") {
            return (
              <li key={first.id} data-speaker="you" className="flex flex-col items-end gap-1.5">
                {group.messages.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
                <p className="text-[11px] text-ink-mute">You · {relativeTime(last.createdAt, now)}</p>
              </li>
            );
          }
          return (
            <li key={first.id} data-speaker="hosty" className="flex items-start gap-2.5">
              <Avatar />
              <div className="min-w-0 space-y-1.5">
                <p className="text-[12px] text-ink-mute">
                  <span className="font-semibold text-ink">Hosty</span> · {relativeTime(first.createdAt, now)}
                </p>
                {group.messages.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
              </div>
            </li>
          );
        })}
        {running ? <Typing /> : null}
      </ol>
    </div>
  );
}

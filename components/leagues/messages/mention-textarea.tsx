"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { formatPersonName } from "@/lib/account/person-name";
import { teamInitials } from "@/lib/leagues/standings";
import {
  getActiveMention,
  insertMentionToken,
  type MentionCandidate,
} from "@/lib/messages/mentions";
import { cn } from "@/lib/utils";

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  candidates: MentionCandidate[];
};

function matchesQuery(candidate: MentionCandidate, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const person = formatPersonName(candidate).toLowerCase();
  const username = candidate.username.toLowerCase();
  const team = candidate.teamName?.toLowerCase() ?? "";
  return (
    person.includes(q) ||
    username.includes(q) ||
    team.includes(q)
  );
}

export function MentionTextarea({
  value,
  onValueChange,
  candidates,
  className,
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const listId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = candidates.filter((candidate) =>
    matchesQuery(candidate, query),
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function syncMentionState(nextValue: string, caret: number) {
    const active = getActiveMention(nextValue, caret);
    if (!active) {
      setOpen(false);
      setQuery("");
      return;
    }
    setOpen(true);
    setMentionStart(active.start);
    setQuery(active.query);
  }

  function selectCandidate(candidate: MentionCandidate) {
    const caret =
      textareaRef.current?.selectionStart ??
      mentionStart + query.length + 1;
    const next = insertMentionToken(
      value,
      caret,
      mentionStart,
      candidate.username,
    );
    onValueChange(next.value);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && filtered.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % filtered.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + filtered.length) % filtered.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const candidate = filtered[activeIndex];
        if (candidate) selectCandidate(candidate);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        onChange={(event) => {
          const next = event.target.value;
          onValueChange(next);
          syncMentionState(next, event.target.selectionStart ?? next.length);
        }}
        onClick={(event) => {
          syncMentionState(
            event.currentTarget.value,
            event.currentTarget.selectionStart ?? 0,
          );
        }}
        onKeyUp={(event) => {
          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "Home" ||
            event.key === "End"
          ) {
            syncMentionState(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? 0,
            );
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 bottom-[calc(100%+0.5rem)] left-0 z-50 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              No members match
            </p>
          ) : (
            filtered.map((candidate, index) => {
              const personName = formatPersonName(candidate);
              const teamLabel = candidate.teamName ?? "No team";
              const selected = index === activeIndex;
              return (
                <button
                  key={candidate.userId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none",
                    selected ? "bg-muted" : "hover:bg-muted/70",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectCandidate(candidate);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <Avatar size="sm">
                    {candidate.teamLogoUrl ? (
                      <AvatarImage src={candidate.teamLogoUrl} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {teamInitials(candidate.teamName ?? personName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {personName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{candidate.username}
                      <span className="text-muted-foreground/80">
                        {" "}
                        · {teamLabel}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

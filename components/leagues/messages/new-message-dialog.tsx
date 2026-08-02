"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  MessageSquarePlus as MessageSquarePlusIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { MentionTextarea } from "@/components/leagues/messages/mention-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createMessageThread } from "@/lib/actions/messages";
import {
  extractMentionUsernames,
  type MentionCandidate,
} from "@/lib/messages/mentions";
import { requestNotificationsRefresh } from "@/lib/notifications/client-refresh";

type NewMessageDialogProps = {
  leagueSlug: string;
  mentionCandidates: MentionCandidate[];
};

export function NewMessageDialog({
  leagueSlug,
  mentionCandidates,
}: NewMessageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setBody("");
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createMessageThread(leagueSlug, { title, body });
      if (!result.success) {
        toast.error(result.error ?? "Could not post message.");
        return;
      }
      setOpen(false);
      reset();
      toast.success("Message posted");
      if (extractMentionUsernames(body).length > 0) {
        requestNotificationsRefresh();
      }
      if (result.threadPublicId) {
        router.push(`/league/${leagueSlug}/messages/${result.threadPublicId}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending && !next) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button
        type="button"
        size="icon"
        className="md:size-auto md:h-9 md:gap-1.5 md:px-2.5"
        aria-label="New message"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon
          icon={MessageSquarePlusIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        <span className="hidden md:inline">New message</span>
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Start a league thread. Everyone in the league can read and reply.
            Use @ to mention someone.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="message-title">Title</FieldLabel>
            <Input
              id="message-title"
              value={title}
              maxLength={120}
              placeholder="Give your message a title"
              disabled={isPending}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="message-body">Message</FieldLabel>
            <MentionTextarea
              id="message-body"
              value={body}
              maxLength={10_000}
              placeholder="Write your message…"
              disabled={isPending}
              className="min-h-36"
              candidates={mentionCandidates}
              onValueChange={setBody}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !title.trim() || !body.trim()}
            onClick={handleSubmit}
          >
            <HugeiconsIcon
              icon={SentIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {isPending ? "Posting…" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

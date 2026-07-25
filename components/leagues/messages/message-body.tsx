import { splitMessageBody } from "@/lib/messages/mentions";

type MessageBodyProps = {
  body: string;
  className?: string;
};

export function MessageBody({ body, className }: MessageBodyProps) {
  const segments = splitMessageBody(body);

  return (
    <p className={className ?? "whitespace-pre-wrap text-pretty"}>
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <strong
            key={`${segment.username}-${index}`}
            className="font-bold"
          >
            {segment.value}
          </strong>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

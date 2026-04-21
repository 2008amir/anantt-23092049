import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/messages")({
  component: MessagesStub,
});

function MessagesStub() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Messages</h1>
      <div className="rounded-lg border border-dashed border-border/40 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Coming next: Inbox of user messages with realtime chat replies.
        </p>
      </div>
    </div>
  );
}

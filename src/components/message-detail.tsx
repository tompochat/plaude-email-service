"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Reply, Archive, Trash2, Mail, MailOpen, Paperclip, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Message, messagesApi } from "@/lib/api";
import { formatEmailAddress } from "@/lib/utils/ui";
import { toast } from "sonner";

interface MessageDetailProps {
  message: Message;
  onReply: (message: Message) => void;
  onUpdate: () => void;
}

export function MessageDetail({ message, onReply, onUpdate }: MessageDetailProps) {
  const [loading, setLoading] = useState(false);
  const [showFullHeaders, setShowFullHeaders] = useState(false);

  const handleToggleRead = async () => {
    setLoading(true);
    try {
      if (message.isRead) {
        await messagesApi.markAsUnread(message.id);
        toast.success("Marked as unread");
      } else {
        await messagesApi.markAsRead(message.id);
        toast.success("Marked as read");
      }
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await messagesApi.archive(message.id);
      toast.success("Message archived");
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this message?")) return;
    setLoading(true);
    try {
      await messagesApi.delete(message.id);
      toast.success("Message deleted");
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'replied':
        return <Badge variant="secondary">Replied</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        {/* Subject */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold break-words flex-1">
            {message.subject || "(No subject)"}
          </h2>
          {getStatusBadge()}
        </div>

        {/* Email details */}
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12">From:</span>
            <span className="font-medium">{formatEmailAddress(message.from)}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-12">To:</span>
            <span>{message.to.map(formatEmailAddress).join(", ")}</span>
          </div>
          
          {showFullHeaders && (
            <>
              {message.cc && message.cc.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-12">CC:</span>
                  <span>{message.cc.map(formatEmailAddress).join(", ")}</span>
                </div>
              )}
              {message.replyTo && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-12">Reply-To:</span>
                  <span>{formatEmailAddress(message.replyTo)}</span>
                </div>
              )}
            </>
          )}
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12">Date:</span>
            <span>{format(new Date(message.date), "PPpp")}</span>
            <button 
              onClick={() => setShowFullHeaders(!showFullHeaders)}
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              {showFullHeaders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onReply(message)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          <Button size="sm" variant="outline" onClick={handleToggleRead} disabled={loading}>
            {message.isRead ? (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Mark Unread
              </>
            ) : (
              <>
                <MailOpen className="h-4 w-4 mr-2" />
                Mark Read
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleArchive} disabled={loading}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={loading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Attachments */}
      {message.hasAttachments && message.attachments && message.attachments.length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Paperclip className="h-4 w-4" />
            <span className="font-medium">Attachments ({message.attachments.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={`/api/attachments/${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border text-sm hover:bg-accent transition-colors"
              >
                <Download className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{attachment.filename}</span>
                <span className="text-muted-foreground text-xs">
                  ({Math.round(attachment.size / 1024)}KB)
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {message.bodyHtml ? (
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {message.bodyText || "(No content)"}
          </pre>
        )}
      </div>
    </div>
  );
}

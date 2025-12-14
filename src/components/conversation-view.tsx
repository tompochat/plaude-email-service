"use client";

import { useState } from "react";
import { format } from "date-fns";
import { 
  Reply, 
  CheckCircle2, 
  RotateCcw, 
  Archive, 
  Trash2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationWithMessages, conversationsApi, Message } from "@/lib/api";
import { formatEmailAddress, cn } from "@/lib/utils/ui";
import { toast } from "sonner";

interface ConversationViewProps {
  conversation: ConversationWithMessages;
  onReply: () => void;
  onUpdate: () => void;
  myEmails: string[];
}

export function ConversationView({ 
  conversation, 
  onReply, 
  onUpdate,
  myEmails 
}: ConversationViewProps) {
  const [loading, setLoading] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => {
    // By default, expand the last message
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    return new Set(lastMsg ? [lastMsg.id] : []);
  });

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedMessages(new Set(conversation.messages.map(m => m.id)));
  };

  const collapseAll = () => {
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    setExpandedMessages(new Set(lastMsg ? [lastMsg.id] : []));
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      await conversationsApi.close(conversation.id);
      toast.success("Conversation closed");
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    try {
      await conversationsApi.reopen(conversation.id);
      toast.success("Conversation reopened");
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
      await conversationsApi.archive(conversation.id);
      toast.success("Conversation archived");
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this entire conversation? This cannot be undone.")) return;
    setLoading(true);
    try {
      await conversationsApi.delete(conversation.id);
      toast.success("Conversation deleted");
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const isMyMessage = (message: Message) => {
    return myEmails.some(email => 
      email.toLowerCase() === message.from.address.toLowerCase()
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        {/* Subject + Status */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold break-words">
            {conversation.subject}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {conversation.status === 'closed' && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Closed
              </Badge>
            )}
            <Badge variant="secondary">
              {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Participants */}
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Participants:</span>{' '}
          {conversation.participants.map(p => p.name || p.address).join(', ')}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          
          {conversation.status === 'open' ? (
            <Button size="sm" variant="outline" onClick={handleClose} disabled={loading}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Close Conversation
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleReopen} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reopen
            </Button>
          )}
          
          <Button size="sm" variant="outline" onClick={handleArchive} disabled={loading}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={loading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>

          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={expandAll}>
              Expand All
            </Button>
            <Button size="sm" variant="ghost" onClick={collapseAll}>
              Collapse
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {conversation.messages.map((message) => {
          const isExpanded = expandedMessages.has(message.id);
          const isMine = isMyMessage(message);
          
          return (
            <div 
              key={message.id}
              className={cn(
                "rounded-lg border",
                isMine ? "bg-primary/5 border-primary/20" : "bg-background"
              )}
            >
              {/* Message Header (always visible) */}
              <div 
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/30 rounded-t-lg"
                onClick={() => toggleMessage(message.id)}
              >
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isMine 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {(message.from.name || message.from.address)[0].toUpperCase()}
                </div>
                
                {/* Sender + Time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {isMine ? 'You' : (message.from.name || message.from.address)}
                    </span>
                    {message.hasAttachments && (
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-muted-foreground truncate">
                      {message.bodyText?.substring(0, 100) || '(No content)'}
                    </p>
                  )}
                </div>
                
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {format(new Date(message.date), "MMM d, h:mm a")}
                </span>
                
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              
              {/* Message Content (collapsible) */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t">
                  {/* To/CC */}
                  <div className="text-xs text-muted-foreground py-2 space-y-1">
                    <div>
                      <span className="font-medium">To:</span>{' '}
                      {message.to.map(formatEmailAddress).join(', ')}
                    </div>
                    {message.cc && message.cc.length > 0 && (
                      <div>
                        <span className="font-medium">CC:</span>{' '}
                        {message.cc.map(formatEmailAddress).join(', ')}
                      </div>
                    )}
                  </div>
                  
                  {/* Attachments */}
                  {message.hasAttachments && message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2 border-t">
                      {message.attachments.map(att => (
                        <a
                          key={att.id}
                          href={`/api/attachments/${att.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{att.filename}</span>
                          <span className="text-muted-foreground">
                            ({Math.round(att.size / 1024)}KB)
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                  
                  {/* Body */}
                  <div className="pt-2 border-t">
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
              )}
            </div>
          );
        })}
      </div>
      
      {/* Quick Reply Bar */}
      <div className="p-4 border-t bg-muted/30">
        <Button className="w-full" onClick={onReply}>
          <Reply className="h-4 w-4 mr-2" />
          Reply to Conversation
        </Button>
      </div>
    </div>
  );
}

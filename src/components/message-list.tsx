"use client";

import { cn, formatDate, truncate } from "@/lib/utils/ui";
import { Message } from "@/lib/api";
import { Paperclip, Send } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  selectedId?: string;
  onSelect: (message: Message) => void;
}

export function MessageList({ messages, selectedId, onSelect }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No messages yet.</p>
        <p className="text-sm mt-1">Sync your accounts to fetch emails.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map((message) => (
        <div
          key={message.id}
          onClick={() => onSelect(message)}
          className={cn(
            "flex gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors",
            selectedId === message.id && "bg-accent",
            !message.isRead && "bg-primary/5"
          )}
        >
          {/* Unread indicator */}
          <div className="flex-shrink-0 w-2 pt-2">
            {!message.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {message.isOutgoing && (
                  <Send className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className={cn(
                  "truncate",
                  !message.isRead ? "font-semibold" : "font-medium"
                )}>
                  {message.isOutgoing 
                    ? `To: ${message.to[0]?.name || message.to[0]?.address}`
                    : message.from.name || message.from.address
                  }
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDate(message.date)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-sm truncate",
                !message.isRead ? "text-foreground" : "text-muted-foreground"
              )}>
                {message.subject || "(No subject)"}
              </span>
              {message.hasAttachments && (
                <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {truncate(message.bodyText?.replace(/\s+/g, ' ') || "", 80)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

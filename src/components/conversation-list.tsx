"use client";

import { cn, formatDate, truncate } from "@/lib/utils/ui";
import { Conversation } from "@/lib/api";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect 
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No conversations yet.</p>
        <p className="text-sm mt-1">Sync your accounts or compose a new email.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onSelect(conversation)}
          className={cn(
            "p-4 cursor-pointer hover:bg-accent/50 transition-colors",
            selectedId === conversation.id && "bg-accent",
            conversation.unreadCount > 0 && "bg-primary/5"
          )}
        >
          {/* Header: Sender + Time */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {/* Status indicator */}
              {conversation.status === 'closed' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : conversation.unreadCount > 0 ? (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              ) : (
                <div className="w-2 h-2 flex-shrink-0" />
              )}
              
              {/* Sender name */}
              <span className={cn(
                "truncate",
                conversation.unreadCount > 0 ? "font-semibold" : "font-medium"
              )}>
                {conversation.lastSender.name || conversation.lastSender.address}
              </span>
            </div>
            
            {/* Time + Count */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {conversation.messageCount > 1 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {conversation.messageCount}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(conversation.lastMessageAt)}
              </span>
            </div>
          </div>
          
          {/* Subject */}
          <div className="flex items-center gap-2 mb-1 pl-6">
            <span className={cn(
              "text-sm truncate",
              conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {conversation.subject}
            </span>
            {conversation.status === 'closed' && (
              <Badge variant="outline" className="text-xs flex-shrink-0 px-1.5 py-0">
                Closed
              </Badge>
            )}
          </div>
          
          {/* Snippet */}
          <p className="text-xs text-muted-foreground pl-6 truncate">
            {truncate(conversation.snippet, 80)}
          </p>
        </div>
      ))}
    </div>
  );
}

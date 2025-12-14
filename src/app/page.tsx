"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, PenSquare, Inbox, ChevronLeft } from "lucide-react";
import { Header } from "@/components/header";
import { MessageList } from "@/components/message-list";
import { MessageDetail } from "@/components/message-detail";
import { ComposeMessage } from "@/components/compose-message";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { messagesApi, accountsApi, syncApi, Message, Account } from "@/lib/api";
import { cn } from "@/lib/utils/ui";
import { toast } from "sonner";

type View = "list" | "detail" | "compose";

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | undefined>(undefined);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const [messagesData, accountsData] = await Promise.all([
        messagesApi.list({ 
          limit: 100,
          accountId: filterAccountId || undefined,
        }),
        accountsApi.list(),
      ]);
      setMessages(messagesData.messages);
      setAccounts(accountsData);
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [filterAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncApi.syncAll();
      toast.success(`Synced! ${result.summary.newMessages} new messages`);
      await loadData();
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message);
    setView("detail");
    
    // Mark as read
    if (!message.isRead) {
      try {
        await messagesApi.markAsRead(message.id);
        setMessages(prev => prev.map(m => 
          m.id === message.id ? { ...m, isRead: true } : m
        ));
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
    setView("compose");
  };

  const handleCompose = () => {
    setReplyTo(undefined);
    setView("compose");
  };

  const handleMessageUpdate = () => {
    loadData();
    setSelectedMessage(null);
    setView("list");
  };

  const handleSent = () => {
    loadData();
    setReplyTo(undefined);
    setView("list");
  };

  const handleBack = () => {
    setView("list");
    setSelectedMessage(null);
  };

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <>
      <Header />
      <main className="h-[calc(100vh-56px)] flex">
        {/* Left Panel - Message List */}
        <div className={cn(
          "w-full md:w-96 border-r flex flex-col bg-background",
          view !== "list" && "hidden md:flex"
        )}>
          {/* Toolbar */}
          <div className="p-3 border-b flex items-center gap-2">
            <Button size="sm" onClick={handleCompose}>
              <PenSquare className="h-4 w-4 mr-2" />
              Compose
            </Button>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
              Sync
            </Button>
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b flex items-center gap-2">
            <Select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="flex-1 h-8 text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.displayName || account.emailAddress}
                </option>
              ))}
            </Select>
          </div>

          {/* Stats */}
          <div className="px-4 py-2 text-sm text-muted-foreground border-b flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span>{messages.length} messages</span>
            {unreadCount > 0 && (
              <span className="text-primary font-medium">({unreadCount} unread)</span>
            )}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <MessageList
                messages={messages}
                selectedId={selectedMessage?.id}
                onSelect={handleSelectMessage}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Detail/Compose */}
        <div className={cn(
          "flex-1 flex flex-col",
          view === "list" && "hidden md:flex"
        )}>
          {/* Mobile back button */}
          {view !== "list" && (
            <div className="md:hidden p-2 border-b">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          )}

          {view === "list" && !selectedMessage && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No message selected</p>
                <p className="text-sm mt-1">Select a message to read</p>
              </div>
            </div>
          )}
          
          {view === "detail" && selectedMessage && (
            <MessageDetail
              message={selectedMessage}
              onReply={handleReply}
              onUpdate={handleMessageUpdate}
            />
          )}
          
          {view === "compose" && (
            <ComposeMessage
              replyTo={replyTo}
              accounts={accounts}
              onClose={() => setView(selectedMessage ? "detail" : "list")}
              onSent={handleSent}
            />
          )}
        </div>
      </main>
    </>
  );
}

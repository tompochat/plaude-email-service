"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, PenSquare, Inbox, ChevronLeft } from "lucide-react";
import { Header } from "@/components/header";
import { ConversationList } from "@/components/conversation-list";
import { ConversationView } from "@/components/conversation-view";
import { ComposeMessage } from "@/components/compose-message";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { 
  conversationsApi, 
  accountsApi, 
  syncApi, 
  Conversation, 
  ConversationWithMessages,
  Account,
  Message 
} from "@/lib/api";
import { cn } from "@/lib/utils/ui";
import { toast } from "sonner";

type View = "list" | "conversation" | "compose";
type StatusFilter = "all" | "open" | "closed";

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMessages | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | undefined>(undefined);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("open");

  const myEmails = accounts.map(a => a.emailAddress);

  const loadData = useCallback(async () => {
    try {
      const [convData, accountsData] = await Promise.all([
        conversationsApi.list({ 
          limit: 100,
          accountId: filterAccountId || undefined,
          status: filterStatus === "all" ? undefined : filterStatus,
        }),
        accountsApi.list(),
      ]);
      setConversations(convData.conversations);
      setAccounts(accountsData);
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [filterAccountId, filterStatus]);

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

  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      const full = await conversationsApi.get(conversation.id);
      setSelectedConversation(full);
      setView("conversation");
      
      // Update the list to reflect read status
      setConversations(prev => prev.map(c => 
        c.id === conversation.id ? { ...c, unreadCount: 0 } : c
      ));
    } catch (err) {
      toast.error("Failed to load conversation");
    }
  };

  const handleReply = () => {
    if (selectedConversation && selectedConversation.messages.length > 0) {
      // Reply to the last message in the conversation
      const lastMessage = selectedConversation.messages[selectedConversation.messages.length - 1];
      setReplyToMessage(lastMessage);
      setView("compose");
    }
  };

  const handleCompose = () => {
    setReplyToMessage(undefined);
    setSelectedConversation(null);
    setView("compose");
  };

  const handleConversationUpdate = () => {
    loadData();
    setSelectedConversation(null);
    setView("list");
  };

  const handleSent = async () => {
    await loadData();
    setReplyToMessage(undefined);
    
    if (selectedConversation) {
      // Refresh the current conversation
      try {
        const full = await conversationsApi.get(selectedConversation.id);
        setSelectedConversation(full);
        setView("conversation");
      } catch {
        setView("list");
      }
    } else {
      setView("list");
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedConversation(null);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <>
      <Header />
      <main className="h-[calc(100vh-56px)] flex">
        {/* Left Panel - Conversation List */}
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="h-8 text-sm"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </Select>
            
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
            <span>{conversations.length} conversations</span>
            {totalUnread > 0 && (
              <span className="text-primary font-medium">({totalUnread} unread)</span>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversation?.id}
                onSelect={handleSelectConversation}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Conversation/Compose */}
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

          {view === "list" && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No conversation selected</p>
                <p className="text-sm mt-1">Select a conversation to view</p>
              </div>
            </div>
          )}
          
          {view === "conversation" && selectedConversation && (
            <ConversationView
              conversation={selectedConversation}
              onReply={handleReply}
              onUpdate={handleConversationUpdate}
              myEmails={myEmails}
            />
          )}
          
          {view === "compose" && (
            <ComposeMessage
              replyTo={replyToMessage}
              accounts={accounts}
              onClose={() => setView(selectedConversation ? "conversation" : "list")}
              onSent={handleSent}
            />
          )}
        </div>
      </main>
    </>
  );
}

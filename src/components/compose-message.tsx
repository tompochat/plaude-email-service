"use client";

import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Message, Account, messagesApi, SendMessageRequest, EmailAddress } from "@/lib/api";
import { toast } from "sonner";

interface ComposeMessageProps {
  replyTo?: Message;
  accounts: Account[];
  onClose: () => void;
  onSent: () => void;
}

export function ComposeMessage({ replyTo, accounts, onClose, onSent }: ComposeMessageProps) {
  const [sending, setSending] = useState(false);
  
  const [formData, setFormData] = useState({
    accountId: replyTo?.accountId || accounts[0]?.id || "",
    to: "",
    cc: "",
    subject: "",
    body: "",
  });

  useEffect(() => {
    if (replyTo) {
      // Pre-fill for reply
      const toAddress = replyTo.from.name 
        ? `${replyTo.from.name} <${replyTo.from.address}>`
        : replyTo.from.address;
      
      const quotedBody = replyTo.bodyText 
        ? `\n\n---\nOn ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from.address} wrote:\n\n${replyTo.bodyText}`
        : "";
      
      setFormData(prev => ({
        ...prev,
        accountId: replyTo.accountId,
        to: toAddress,
        subject: replyTo.subject.startsWith("Re:") 
          ? replyTo.subject 
          : `Re: ${replyTo.subject}`,
        body: quotedBody,
      }));
    }
  }, [replyTo]);

  const parseEmailAddresses = (str: string): EmailAddress[] => {
    if (!str.trim()) return [];
    return str.split(",").map(s => {
      const match = s.trim().match(/^(.+?)\s*<(.+)>$/);
      if (match) {
        return { name: match[1].trim(), address: match[2].trim() };
      }
      return { address: s.trim() };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.to.trim()) {
      toast.error("Please enter a recipient");
      return;
    }
    
    if (!formData.body.trim() && !formData.subject.trim()) {
      toast.error("Please enter a subject or message");
      return;
    }

    setSending(true);

    try {
      const request: SendMessageRequest = {
        accountId: formData.accountId,
        to: parseEmailAddresses(formData.to),
        cc: formData.cc ? parseEmailAddresses(formData.cc) : undefined,
        subject: formData.subject,
        bodyText: formData.body,
        inReplyTo: replyTo?.id,
      };

      await messagesApi.send(request);
      toast.success("Message sent!");
      onSent();
    } catch (err) {
      toast.error(`Failed to send: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === formData.accountId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">
          {replyTo ? "Reply" : "New Message"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 space-y-3 border-b">
          {/* From Account */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16 flex-shrink-0">From:</label>
            <Select
              value={formData.accountId}
              onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
              className="flex-1"
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.displayName || account.emailAddress} ({account.emailAddress})
                </option>
              ))}
            </Select>
          </div>

          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16 flex-shrink-0">To:</label>
            <Input
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              placeholder="recipient@example.com"
              className="flex-1"
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16 flex-shrink-0">CC:</label>
            <Input
              value={formData.cc}
              onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
              placeholder="cc@example.com (optional)"
              className="flex-1"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16 flex-shrink-0">Subject:</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Subject"
              className="flex-1"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 overflow-hidden">
          <Textarea
            value={formData.body}
            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Write your message..."
            className="h-full resize-none"
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Sending as: {selectedAccount?.emailAddress || "No account selected"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending || accounts.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

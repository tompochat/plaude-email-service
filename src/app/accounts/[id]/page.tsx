"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2, RefreshCw, Edit2, Save, X, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { accountsApi, syncApi, Account, UpdateAccountRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils/ui";
import { toast } from "sonner";

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;
  
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [editData, setEditData] = useState<UpdateAccountRequest>({});

  const loadAccount = useCallback(async () => {
    try {
      const data = await accountsApi.get(accountId);
      setAccount(data);
      setEditData({
        displayName: data.displayName || "",
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncApi.syncAccount(accountId);
      toast.success(`Synced! ${result.summary.newMessages} new messages`);
      loadAccount();
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      return;
    }
    
    setDeleting(true);
    try {
      await accountsApi.delete(accountId);
      toast.success("Account deleted");
      router.push("/accounts");
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountsApi.update(accountId, editData);
      toast.success("Account updated");
      setEditing(false);
      loadAccount();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'disconnected': return <XCircle className="h-5 w-5 text-gray-500" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'> = {
      active: 'success',
      error: 'destructive',
      pending: 'secondary',
      disconnected: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="container mx-auto py-6 px-4 flex items-center justify-center">
          <Spinner size="lg" />
        </main>
      </>
    );
  }

  if (error || !account) {
    return (
      <>
        <Header />
        <main className="container mx-auto py-6 px-4">
          <Link href="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Link>
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            {error || "Account not found"}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container mx-auto py-6 px-4 max-w-2xl">
        <Link href="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(account.status)}
                <div>
                  <CardTitle className="text-xl">
                    {account.displayName || account.emailAddress}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{account.emailAddress}</p>
                </div>
              </div>
              {getStatusBadge(account.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
              
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="ml-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>

            {/* Account Details */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                {editing ? (
                  <Input
                    name="displayName"
                    value={editData.displayName || ""}
                    onChange={handleEditChange}
                    placeholder="Display name"
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1">{account.displayName || "—"}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IMAP Server</label>
                  {editing ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        name="imapHost"
                        value={editData.imapHost || ""}
                        onChange={handleEditChange}
                        placeholder="imap.example.com"
                        className="flex-1"
                      />
                      <Input
                        name="imapPort"
                        type="number"
                        value={editData.imapPort || ""}
                        onChange={handleEditChange}
                        className="w-20"
                      />
                    </div>
                  ) : (
                    <p className="mt-1">{account.imapHost}:{account.imapPort}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">SMTP Server</label>
                  {editing ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        name="smtpHost"
                        value={editData.smtpHost || ""}
                        onChange={handleEditChange}
                        placeholder="smtp.example.com"
                        className="flex-1"
                      />
                      <Input
                        name="smtpPort"
                        type="number"
                        value={editData.smtpPort || ""}
                        onChange={handleEditChange}
                        className="w-20"
                      />
                    </div>
                  ) : (
                    <p className="mt-1">{account.smtpHost}:{account.smtpPort}</p>
                  )}
                </div>
              </div>

              {editing && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">New Password (leave blank to keep current)</label>
                  <Input
                    name="password"
                    type="password"
                    value={editData.password || ""}
                    onChange={handleEditChange}
                    placeholder="New password"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Synced</label>
                  <p className="mt-1">
                    {account.lastSyncAt ? formatDate(account.lastSyncAt) : "Never"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="mt-1">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {account.lastError && (
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium text-destructive">Last Error</label>
                  <p className="mt-1 text-sm text-destructive">{account.lastError}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

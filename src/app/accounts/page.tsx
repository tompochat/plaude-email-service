"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Mail, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { accountsApi, Account } from "@/lib/api";
import { formatDate } from "@/lib/utils/ui";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await accountsApi.list();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'disconnected': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
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

  return (
    <>
      <Header />
      <main className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Email Accounts</h1>
            <p className="text-muted-foreground">Manage your connected email accounts</p>
          </div>
          <Link href="/accounts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No accounts connected</p>
              <p className="text-muted-foreground mb-4">Add your first email account to get started</p>
              <Link href="/accounts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} href={`/accounts/${account.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium truncate">
                      {account.displayName || account.emailAddress}
                    </CardTitle>
                    {getStatusIcon(account.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 truncate">
                    {account.emailAddress}
                  </p>
                  <div className="flex items-center justify-between">
                    {getStatusBadge(account.status)}
                    {account.lastSyncAt && (
                      <span className="text-xs text-muted-foreground">
                        Synced {formatDate(account.lastSyncAt)}
                      </span>
                    )}
                  </div>
                  {account.lastError && (
                    <p className="text-xs text-destructive mt-2 truncate">
                      {account.lastError}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

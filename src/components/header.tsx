"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/ui";
import { syncApi } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { MailIcon } from "@/components/icons/mail-icon";

export function Header() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncApi.syncAll();
      toast.success(`Synced! ${result.summary.newMessages} new messages`);
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <MailIcon className="h-5 w-5" />
          <span>Mail Service</span>
        </Link>
        
        <nav className="flex items-center gap-1 ml-6">
          <Link href="/">
            <Button 
              variant={pathname === "/" ? "secondary" : "ghost"}
              size="sm"
            >
              Inbox
            </Button>
          </Link>
          <Link href="/accounts">
            <Button 
              variant={pathname.startsWith("/accounts") ? "secondary" : "ghost"}
              size="sm"
            >
              Accounts
            </Button>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>
      </div>
    </header>
  );
}

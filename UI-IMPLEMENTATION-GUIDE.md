# UI Implementation Guide

> **Goal:** Add a simple, modern shadcn-style UI for managing email accounts and viewing/responding to emails in a WhatsApp Web-like interface.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Setup & Dependencies](#phase-1-setup--dependencies)
4. [Phase 2: Layout & Navigation](#phase-2-layout--navigation)
5. [Phase 3: Accounts Management](#phase-3-accounts-management)
6. [Phase 4: Unified Inbox (WhatsApp-style)](#phase-4-unified-inbox-whatsapp-style)
7. [Phase 5: Message Composer & Reply](#phase-5-message-composer--reply)
8. [Phase 6: Sync & Polish](#phase-6-sync--polish)
9. [File Structure](#file-structure)
10. [API Notes](#api-notes)

---

## Overview

### What We're Building

```
┌────────────────────────────────────────────────────────────────────────┐
│  Mail Service                                              [Settings]  │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌───────────────────────────────────────────┐ │
│ │ 🔄 Sync All          │ │                                           │ │
│ │                      │ │  From: john@example.com                   │ │
│ │ ┌──────────────────┐ │ │  To: me@company.com                       │ │
│ │ │ ● John Smith     │ │ │  Subject: Meeting Tomorrow                │ │
│ │ │   Meeting Tomorr │ │ │  Date: Dec 14, 2025 10:30 AM              │ │
│ │ │   10:30 AM       │ │ │                                           │ │
│ │ └──────────────────┘ │ │  ─────────────────────────────────────    │ │
│ │ ┌──────────────────┐ │ │                                           │ │
│ │ │   Jane Doe       │ │ │  Hi there,                                │ │
│ │ │   Invoice #1234  │ │ │                                           │ │
│ │ │   Yesterday      │ │ │  Just wanted to confirm our meeting       │ │
│ │ └──────────────────┘ │ │  tomorrow at 2pm.                         │ │
│ │ ┌──────────────────┐ │ │                                           │ │
│ │ │   Support Team   │ │ │  Best,                                    │ │
│ │ │   Ticket #5678   │ │ │  John                                     │ │
│ │ │   2 days ago     │ │ │                                           │ │
│ │ └──────────────────┘ │ │  ─────────────────────────────────────    │ │
│ │                      │ │                                           │ │
│ │                      │ │  [Reply]                                  │ │
│ └──────────────────────┘ └───────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Accounts Page** | List, create, view, edit, delete email accounts |
| **Unified Inbox** | All messages from all accounts in one view |
| **Message List** | WhatsApp-style list with unread indicators |
| **Message Detail** | View full email content with reply option |
| **Compose/Reply** | Simple email composer for sending/replying |
| **Sync** | Manual sync button for fetching new emails |

---

## Prerequisites

Before starting, ensure you have:

- [x] Working mail-service API (accounts, messages, sync endpoints)
- [x] Node.js 18+ installed
- [x] Environment variables configured (`.env.local`)

---

## Phase 1: Setup & Dependencies

### Step 1.1: Install Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 1.2: Configure Tailwind

Create/update `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

### Step 1.3: Add Global Styles

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Step 1.4: Install UI Utilities

```bash
npm install clsx tailwind-merge lucide-react
```

### Step 1.5: Create Utility Functions

Create `src/lib/utils.ts` (update existing or create):

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
```

### Step 1.6: Create API Client

Create `src/lib/api.ts`:

```typescript
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

async function fetchAPI<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
}

// ============================================================================
// Accounts
// ============================================================================

export const accountsApi = {
  list: (clientId?: string) => 
    fetchAPI<Account[]>(`/accounts${clientId ? `?clientId=${clientId}` : ''}`),
  
  get: (id: string) => 
    fetchAPI<Account>(`/accounts/${id}`),
  
  create: (data: CreateAccountRequest) => 
    fetchAPI<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: UpdateAccountRequest) => 
    fetchAPI<Account>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) => 
    fetchAPI<void>(`/accounts/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// Messages
// ============================================================================

export interface MessageFilters {
  accountId?: string;
  clientId?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export const messagesApi = {
  list: (filters: MessageFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    return fetchAPI<{ messages: Message[]; pagination: Pagination }>(
      `/messages?${params}`
    );
  },
  
  get: (id: string) => 
    fetchAPI<Message>(`/messages/${id}`),
  
  markAsRead: (id: string) => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    }),
  
  markAsUnread: (id: string) => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: false }),
    }),
  
  archive: (id: string) => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    }),
  
  delete: (id: string) => 
    fetchAPI<void>(`/messages/${id}`, { method: 'DELETE' }),
  
  send: (data: SendMessageRequest) => 
    fetchAPI<{ messageId?: string }>('/messages/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================================================
// Sync
// ============================================================================

export const syncApi = {
  syncAll: () => 
    fetchAPI<SyncResponse>('/sync', { method: 'POST' }),
  
  syncAccount: (accountId: string) => 
    fetchAPI<SyncResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
};

// ============================================================================
// Types (re-export from your types)
// ============================================================================

export interface Account {
  id: string;
  clientId: string;
  provider: string;
  emailAddress: string;
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  status: 'active' | 'error' | 'disconnected' | 'pending';
  lastError?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  clientId: string;
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  useTls?: boolean;
}

export interface UpdateAccountRequest {
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
}

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface Message {
  id: string;
  accountId: string;
  clientId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  date: string;
  isRead: boolean;
  isOutgoing: boolean;
  status: 'new' | 'read' | 'replied' | 'archived';
  hasAttachments: boolean;
}

export interface SendMessageRequest {
  accountId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SyncResponse {
  results: { accountId: string; success: boolean; newMessages: number; error?: string }[];
  summary: { total: number; successful: number; failed: number; newMessages: number };
}
```

---

## Phase 2: Layout & Navigation

### Step 2.1: Create Base UI Components

Create `src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            'default': "bg-primary text-primary-foreground hover:bg-primary/90",
            'destructive': "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            'outline': "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            'secondary': "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            'ghost': "hover:bg-accent hover:text-accent-foreground",
            'link': "text-primary underline-offset-4 hover:underline",
          }[variant],
          {
            'default': "h-10 px-4 py-2",
            'sm': "h-9 rounded-md px-3",
            'lg': "h-11 rounded-md px-8",
            'icon': "h-10 w-10",
          }[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
```

Create `src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

Create `src/components/ui/textarea.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

Create `src/components/ui/card.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
```

Create `src/components/ui/badge.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          'default': "border-transparent bg-primary text-primary-foreground",
          'secondary': "border-transparent bg-secondary text-secondary-foreground",
          'destructive': "border-transparent bg-destructive text-destructive-foreground",
          'outline': "text-foreground",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
```

### Step 2.2: Create Main Layout

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mail Service",
  description: "Multi-account email management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
```

### Step 2.3: Create Navigation Header

Create `src/components/header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncApi } from "@/lib/api";
import { useState } from "react";

export function Header() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncApi.syncAll();
      alert(`Synced! New messages: ${result.summary.newMessages}`);
    } catch (error) {
      alert(`Sync failed: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="border-b">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Mail className="h-5 w-5" />
          <span>Mail Service</span>
        </Link>
        
        <nav className="flex items-center gap-2 ml-6">
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
```

---

## Phase 3: Accounts Management

### Step 3.1: Accounts List Page

Create `src/app/accounts/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Mail, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { accountsApi, Account } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
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

        {loading && <p className="text-muted-foreground">Loading...</p>}
        
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
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">
                      {account.displayName || account.emailAddress}
                    </CardTitle>
                    {getStatusIcon(account.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
```

### Step 3.2: Create Account Page

Create `src/app/accounts/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountsApi, CreateAccountRequest } from "@/lib/api";

export default function NewAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateAccountRequest>({
    clientId: "default", // You might want to make this dynamic
    emailAddress: "",
    displayName: "",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 587,
    username: "",
    password: "",
    useTls: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await accountsApi.create(formData);
      router.push("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle>Add Email Account</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address *</label>
                  <Input
                    name="emailAddress"
                    type="email"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">IMAP Settings (Incoming)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IMAP Host *</label>
                    <Input
                      name="imapHost"
                      value={formData.imapHost}
                      onChange={handleChange}
                      required
                      placeholder="imap.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IMAP Port *</label>
                    <Input
                      name="imapPort"
                      type="number"
                      value={formData.imapPort}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">SMTP Settings (Outgoing)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SMTP Host *</label>
                    <Input
                      name="smtpHost"
                      value={formData.smtpHost}
                      onChange={handleChange}
                      required
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SMTP Port *</label>
                    <Input
                      name="smtpPort"
                      type="number"
                      value={formData.smtpPort}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">Credentials</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username *</label>
                    <Input
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password *</label>
                    <Input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="App password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Account"}
                </Button>
                <Link href="/accounts">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
```

### Step 3.3: Account Detail Page (View/Edit/Delete)

Create `src/app/accounts/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2, RefreshCw, Edit2, Save, X } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { accountsApi, syncApi, Account, UpdateAccountRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  async function loadAccount() {
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
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncApi.syncAccount(accountId);
      alert(`Synced! New messages: ${result.summary.newMessages}`);
      loadAccount();
    } catch (err) {
      alert(`Sync failed: ${err}`);
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
      router.push("/accounts");
    } catch (err) {
      alert(`Delete failed: ${err}`);
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountsApi.update(accountId, editData);
      setEditing(false);
      loadAccount();
    } catch (err) {
      alert(`Save failed: ${err}`);
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

  if (loading) {
    return (
      <>
        <Header />
        <main className="container mx-auto py-6 px-4">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }

  if (error || !account) {
    return (
      <>
        <Header />
        <main className="container mx-auto py-6 px-4">
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{account.displayName || account.emailAddress}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{account.emailAddress}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={account.status === 'active' ? 'default' : 'destructive'}>
                {account.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-2">
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
              
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>

            {/* Account Details */}
            <div className="grid gap-4">
              <div>
                <h3 className="font-medium mb-2">Display Name</h3>
                {editing ? (
                  <Input
                    name="displayName"
                    value={editData.displayName || ""}
                    onChange={handleEditChange}
                    placeholder="Display name"
                  />
                ) : (
                  <p className="text-muted-foreground">{account.displayName || "—"}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-2">IMAP Host</h3>
                  {editing ? (
                    <Input
                      name="imapHost"
                      value={editData.imapHost || ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    <p className="text-muted-foreground">{account.imapHost}:{account.imapPort}</p>
                  )}
                </div>
                <div>
                  <h3 className="font-medium mb-2">SMTP Host</h3>
                  {editing ? (
                    <Input
                      name="smtpHost"
                      value={editData.smtpHost || ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    <p className="text-muted-foreground">{account.smtpHost}:{account.smtpPort}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-2">Last Synced</h3>
                  <p className="text-muted-foreground">
                    {account.lastSyncAt ? formatDate(account.lastSyncAt) : "Never"}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Created</h3>
                  <p className="text-muted-foreground">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {account.lastError && (
                <div>
                  <h3 className="font-medium mb-2 text-destructive">Last Error</h3>
                  <p className="text-destructive text-sm">{account.lastError}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
```

### Step 3.4: Add PATCH Endpoint for Account Updates

⚠️ **Important:** Your current API is missing a PATCH endpoint for updating accounts. Add it to `src/app/api/accounts/[accountId]/route.ts`:

```typescript
// Add this import at the top
import { updateAccountSchema } from '@/lib/utils/validation';

// Add this new endpoint
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { accountId } = await params;
    const body = await request.json();
    const validated = updateAccountSchema.parse(body);
    
    // Update account
    const result = await accountService.updateAccount(accountId, validated);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>>>({
      success: true,
      data: result.data,
    });
    
  } catch (error) {
    console.error('Error updating account:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        { 
          success: false, 
          error: 'Validation failed',
          details: error
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update account' 
      },
      { status: 500 }
    );
  }
}
```

---

## Phase 4: Unified Inbox (WhatsApp-style)

### Step 4.1: Create Message List Component

Create `src/components/message-list.tsx`:

```tsx
"use client";

import { cn, formatDate, truncate } from "@/lib/utils";
import { Message } from "@/lib/api";
import { Paperclip } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  selectedId?: string;
  onSelect: (message: Message) => void;
}

export function MessageList({ messages, selectedId, onSelect }: MessageListProps) {
  return (
    <div className="divide-y">
      {messages.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No messages yet. Sync your accounts to fetch emails.
        </div>
      )}
      
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
          <div className="flex-shrink-0 pt-2">
            {!message.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "font-medium truncate",
                !message.isRead && "font-semibold"
              )}>
                {message.isOutgoing 
                  ? `To: ${message.to[0]?.name || message.to[0]?.address}`
                  : message.from.name || message.from.address
                }
              </span>
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
              {truncate(message.bodyText || "", 80)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 4.2: Create Message Detail Component

Create `src/components/message-detail.tsx`:

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Reply, Archive, Trash2, Mail, MailOpen, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, messagesApi } from "@/lib/api";

interface MessageDetailProps {
  message: Message;
  onReply: (message: Message) => void;
  onUpdate: () => void;
}

export function MessageDetail({ message, onReply, onUpdate }: MessageDetailProps) {
  const [loading, setLoading] = useState(false);

  const handleToggleRead = async () => {
    setLoading(true);
    try {
      if (message.isRead) {
        await messagesApi.markAsUnread(message.id);
      } else {
        await messagesApi.markAsRead(message.id);
      }
      onUpdate();
    } catch (err) {
      alert(`Failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await messagesApi.archive(message.id);
      onUpdate();
    } catch (err) {
      alert(`Failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this message?")) return;
    setLoading(true);
    try {
      await messagesApi.delete(message.id);
      onUpdate();
    } catch (err) {
      alert(`Failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatEmailAddress = (addr: { address: string; name?: string }) => {
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold break-words">
              {message.subject || "(No subject)"}
            </h2>
            <div className="text-sm text-muted-foreground mt-2 space-y-1">
              <p>
                <span className="font-medium">From:</span>{" "}
                {formatEmailAddress(message.from)}
              </p>
              <p>
                <span className="font-medium">To:</span>{" "}
                {message.to.map(formatEmailAddress).join(", ")}
              </p>
              {message.cc && message.cc.length > 0 && (
                <p>
                  <span className="font-medium">CC:</span>{" "}
                  {message.cc.map(formatEmailAddress).join(", ")}
                </p>
              )}
              <p>
                <span className="font-medium">Date:</span>{" "}
                {format(new Date(message.date), "PPpp")}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
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
      {message.hasAttachments && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            <span>This message has attachments</span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {message.bodyHtml ? (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {message.bodyText || "(No content)"}
          </pre>
        )}
      </div>
    </div>
  );
}
```

### Step 4.3: Create Compose/Reply Component

Create `src/components/compose-message.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Message, Account, messagesApi, accountsApi, SendMessageRequest } from "@/lib/api";

interface ComposeMessageProps {
  replyTo?: Message;
  accounts: Account[];
  onClose: () => void;
  onSent: () => void;
}

export function ComposeMessage({ replyTo, accounts, onClose, onSent }: ComposeMessageProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      
      setFormData(prev => ({
        ...prev,
        accountId: replyTo.accountId,
        to: toAddress,
        subject: replyTo.subject.startsWith("Re:") 
          ? replyTo.subject 
          : `Re: ${replyTo.subject}`,
        body: `\n\n---\nOn ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from.address} wrote:\n\n${replyTo.bodyText || ""}`,
      }));
    }
  }, [replyTo]);

  const parseEmailAddresses = (str: string) => {
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
    setSending(true);
    setError(null);

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
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === formData.accountId);

  return (
    <div className="flex flex-col h-full">
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
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* From Account */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16">From:</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.displayName || account.emailAddress} ({account.emailAddress})
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16">To:</label>
            <Input
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              placeholder="recipient@example.com"
              className="flex-1"
              required
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16">CC:</label>
            <Input
              value={formData.cc}
              onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
              placeholder="cc@example.com (optional)"
              className="flex-1"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-16">Subject:</label>
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
            Sending as: {selectedAccount?.emailAddress}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
```

### Step 4.4: Create Main Inbox Page

Update `src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, PenSquare, Inbox, Filter } from "lucide-react";
import { Header } from "@/components/header";
import { MessageList } from "@/components/message-list";
import { MessageDetail } from "@/components/message-detail";
import { ComposeMessage } from "@/components/compose-message";
import { Button } from "@/components/ui/button";
import { messagesApi, accountsApi, syncApi, Message, Account } from "@/lib/api";

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
      await syncApi.syncAll();
      await loadData();
    } catch (err) {
      alert(`Sync failed: ${err}`);
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

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <>
      <Header />
      <main className="h-[calc(100vh-56px)] flex">
        {/* Left Panel - Message List */}
        <div className="w-full md:w-96 border-r flex flex-col bg-background">
          {/* Toolbar */}
          <div className="p-3 border-b flex items-center gap-2">
            <Button size="sm" onClick={handleCompose}>
              <PenSquare className="h-4 w-4 mr-2" />
              Compose
            </Button>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            
            {/* Account Filter */}
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="ml-auto h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.displayName || account.emailAddress}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="px-4 py-2 text-sm text-muted-foreground border-b">
            <Inbox className="h-4 w-4 inline mr-2" />
            {messages.length} messages
            {unreadCount > 0 && ` (${unreadCount} unread)`}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
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
        <div className="hidden md:flex flex-1 flex-col">
          {view === "list" && !selectedMessage && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a message to read</p>
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
```

---

## Phase 5: Message Composer & Reply

The compose functionality is already included in Phase 4. Here are some additional enhancements you might want:

### Step 5.1: Add Date Formatting Utility

Install date-fns for better date formatting:

```bash
npm install date-fns
```

---

## Phase 6: Sync & Polish

### Step 6.1: Add Loading States

Create `src/components/ui/spinner.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent h-4 w-4",
        className
      )}
    />
  );
}
```

### Step 6.2: Add Toast Notifications (Optional)

For a better UX, you could add toast notifications. A simple approach:

```bash
npm install sonner
```

Update `src/app/layout.tsx`:

```tsx
import { Toaster } from 'sonner';

// Add inside body:
<Toaster position="bottom-right" />
```

Then use `toast.success("Message sent!")` instead of `alert()`.

### Step 6.3: Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_API_KEY=your-service-api-key
```

---

## File Structure

After implementation, your UI files should look like:

```
src/
├── app/
│   ├── globals.css              # Tailwind + CSS variables
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Inbox page (main)
│   ├── accounts/
│   │   ├── page.tsx             # Accounts list
│   │   ├── new/
│   │   │   └── page.tsx         # Create account
│   │   └── [id]/
│   │       └── page.tsx         # Account detail/edit
│   └── api/                     # (existing API routes)
├── components/
│   ├── header.tsx               # Navigation header
│   ├── message-list.tsx         # WhatsApp-style message list
│   ├── message-detail.tsx       # Email viewer
│   ├── compose-message.tsx      # Email composer
│   └── ui/
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       └── spinner.tsx
├── lib/
│   ├── api.ts                   # API client
│   └── utils.ts                 # Utility functions (cn, formatDate, etc.)
└── types/
    └── index.ts                 # (existing types)
```

---

## API Notes

### Missing Endpoint

Your current API doesn't have a PATCH endpoint for updating accounts. Add it as described in Phase 3, Step 3.4.

### Authentication

The UI uses `NEXT_PUBLIC_API_KEY` environment variable for client-side API calls. Make sure this matches your `SERVICE_API_KEY`.

### Unified Inbox

The inbox shows all messages from all accounts by default. Users can filter by account using the dropdown.

---

## Quick Start Checklist

- [ ] Install dependencies (Tailwind, utilities)
- [ ] Configure Tailwind
- [ ] Add global CSS with shadcn variables
- [ ] Create UI components (button, input, card, etc.)
- [ ] Create API client (`lib/api.ts`)
- [ ] Add utility functions (`lib/utils.ts`)
- [ ] Create Header component
- [ ] Create Accounts pages (list, create, detail)
- [ ] Add PATCH endpoint for account updates
- [ ] Create Inbox page with message list
- [ ] Create MessageDetail component
- [ ] Create ComposeMessage component
- [ ] Add environment variables
- [ ] Test the full flow

---

## Estimated Implementation Time

| Phase | Time |
|-------|------|
| Phase 1: Setup | 30 min |
| Phase 2: Layout | 30 min |
| Phase 3: Accounts | 1.5 hours |
| Phase 4: Inbox | 2 hours |
| Phase 5: Compose | 30 min |
| Phase 6: Polish | 30 min |
| **Total** | **~5-6 hours** |

---

Good luck with your implementation! 🚀

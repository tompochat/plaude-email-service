"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { accountsApi, CreateAccountRequest } from "@/lib/api";
import { toast } from "sonner";

export default function NewAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateAccountRequest>({
    clientId: "default",
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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await accountsApi.create(formData);
      toast.success("Account created successfully!");
      router.push("/accounts");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill common providers
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, emailAddress: email, username: email }));
    
    // Auto-detect provider settings
    if (email.includes('@gmail.com')) {
      setFormData(prev => ({
        ...prev,
        emailAddress: email,
        username: email,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
      }));
    } else if (email.includes('@outlook.com') || email.includes('@hotmail.com')) {
      setFormData(prev => ({
        ...prev,
        emailAddress: email,
        username: email,
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
      }));
    } else if (email.includes('@yahoo.com')) {
      setFormData(prev => ({
        ...prev,
        emailAddress: email,
        username: email,
        imapHost: 'imap.mail.yahoo.com',
        imapPort: 993,
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: 587,
      }));
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
            <CardDescription>
              Connect a new IMAP/SMTP email account. For Gmail, use an App Password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Account Information
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address *</label>
                    <Input
                      name="emailAddress"
                      type="email"
                      value={formData.emailAddress}
                      onChange={handleEmailChange}
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
              </div>

              {/* IMAP Settings */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  IMAP Settings (Incoming Mail)
                </h3>
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

              {/* SMTP Settings */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  SMTP Settings (Outgoing Mail)
                </h3>
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

              {/* Credentials */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Credentials
                </h3>
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
                    <p className="text-xs text-muted-foreground">
                      For Gmail, create an App Password in your Google Account settings
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
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

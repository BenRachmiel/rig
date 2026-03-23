"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { preampApi } from "@/lib/preamp-api";
import type { Credential } from "@/types/api";

interface Props {
  onCreated: () => void;
}

export function CreateCredentialDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [legacyAuth, setLegacyAuth] = useState(true);
  const [ttl, setTtl] = useState("168h");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Credential | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cred = await preampApi.createCredential({
        client_name: clientName,
        legacy_auth: legacyAuth,
        ttl,
      });
      setResult(cred);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (result?.secret) {
      navigator.clipboard.writeText(result.secret);
      toast.success("Copied to clipboard");
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setResult(null);
      setClientName("");
      setLegacyAuth(true);
      setTtl("168h");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button />}>
        New Credential
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Credential Created</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Copy the secret below. It will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all select-all">
                {result.secret}
              </code>
              <Button size="icon" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-500">
              This secret will not be shown again. Store it securely.
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New Credential</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Symfonium, Feishin"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="legacy_auth">Legacy Auth</Label>
                <p className="text-xs text-muted-foreground">
                  Enable for clients using password auth
                </p>
              </div>
              <Checkbox
                id="legacy_auth"
                checked={legacyAuth}
                onCheckedChange={(v) => setLegacyAuth(v === true)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ttl">Expires After</Label>
              <Select value={ttl} onValueChange={(v) => v && setTtl(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="168h">7 days</SelectItem>
                  <SelectItem value="720h">30 days</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

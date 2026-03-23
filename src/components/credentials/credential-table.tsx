"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/time";
import type { Credential } from "@/types/api";

interface Props {
  credentials: Credential[];
  onRenew: (id: string) => void;
  onRevoke: (id: string) => void;
}

export function CredentialTable({ credentials, onRenew, onRevoke }: Props) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No credentials yet. Create one to connect a Subsonic client.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credentials.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.client_name}</TableCell>
              <TableCell>
                <Badge variant={c.legacy_auth ? "secondary" : "outline"}>
                  {c.legacy_auth ? "Legacy" : "API Key"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {relativeTime(c.created_at)}
              </TableCell>
              <TableCell>
                {c.expires_at ? (
                  <span
                    className={
                      c.expired
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {c.expired ? "Expired" : relativeTime(c.expires_at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-2">
                  {c.expires_at && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRenew(c.id)}
                    >
                      Renew
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onRevoke(c.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

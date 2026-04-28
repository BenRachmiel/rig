"use client";

import { useEffect, useState, useCallback } from "react";
import { preampApi } from "@/lib/preamp-api";
import { CredentialTable } from "@/components/credentials/credential-table";
import { CreateCredentialDialog } from "@/components/credentials/create-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Credential } from "@/types/api";

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      setCredentials(await preampApi.listCredentials());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleRenew = async (id: string) => {
    await preampApi.renewCredential(id);
    fetchCredentials();
  };

  const handleRevoke = (id: string) => {
    setRevokeId(id);
  };

  const confirmRevoke = async () => {
    if (!revokeId) return;
    await preampApi.deleteCredential(revokeId);
    setRevokeId(null);
    fetchCredentials();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Manage Subsonic client credentials
          </p>
        </div>
        <CreateCredentialDialog onCreated={fetchCredentials} />
      </div>

      {loading ? (
        <div className="rounded-lg border">
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <CredentialTable
          credentials={credentials}
          onRenew={handleRenew}
          onRevoke={handleRevoke}
        />
      )}

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => !open && setRevokeId(null)}
        title="Revoke credential"
        description="Revoke this credential? Connected clients will lose access."
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
      />
    </div>
  );
}

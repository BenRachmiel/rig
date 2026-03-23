"use client";

import { useEffect, useState, useCallback } from "react";
import { preampApi } from "@/lib/preamp-api";
import { CredentialTable } from "@/components/credentials/credential-table";
import { CreateCredentialDialog } from "@/components/credentials/create-dialog";
import type { Credential } from "@/types/api";

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this credential? Connected clients will lose access."))
      return;
    await preampApi.deleteCredential(id);
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
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
        <CredentialTable
          credentials={credentials}
          onRenew={handleRenew}
          onRevoke={handleRevoke}
        />
      )}
    </div>
  );
}

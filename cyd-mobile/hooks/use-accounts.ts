import { useCallback, useEffect, useRef, useState } from "react";

import {
  ensureDevSeedData,
  listAccounts,
  type AccountListItem,
} from "@/database/accounts";

export type UseAccountsResult = {
  accounts: AccountListItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      await ensureDevSeedData();
      const data = await listAccounts();
      if (mountedRef.current) {
        setAccounts(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { accounts, loading, error, refresh };
}

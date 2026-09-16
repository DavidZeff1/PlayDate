import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services';
import type { Account, Family, ParentProfile, Session } from '../domain/types';

/**
 * Session and current-family state.
 *
 * Deliberately thin: it holds who is signed in and their own family, and nothing that
 * belongs to another family. Anything about another family is fetched per-page through
 * the API, which applies disclosure rules. Caching other families' data in a global
 * store would be the easiest way to accidentally render it in a context where the
 * viewer is no longer entitled to it.
 */

interface AppState {
  session: Session | null;
  family: Family | null;
  account: Account | null;
  parent: ParentProfile | null;
  loading: boolean;
  /** Re-fetch the viewer's own state after a mutation. */
  refresh: () => Promise<void>;
  setSession: (s: Session | null) => void;
  signOut: () => Promise<void>;
  /** Convenience: does the viewer currently meet the bar for discovery? */
  canDiscover: boolean;
}

const AppContext = createContext<AppState>({
  session: null,
  family: null,
  account: null,
  parent: null,
  loading: true,
  refresh: async () => {},
  setSession: () => {},
  signOut: async () => {},
  canDiscover: false,
});

export function useApp(): AppState {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = await api.getSession();
    setSessionState(s);

    if (!s) {
      setFamily(null);
      setAccount(null);
      setParent(null);
      setLoading(false);
      return;
    }

    try {
      const fam = await api.getMyFamily();
      setFamily(fam);
      if (fam) {
        const dash = await api.getDashboard();
        setAccount(dash.account);
        setParent(dash.parent);
      } else {
        setAccount(null);
        setParent(null);
      }
    } catch {
      // A family may not exist yet during onboarding — that is a normal state, not an
      // error worth surfacing.
      setFamily(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setSession = useCallback(
    (s: Session | null) => {
      setSessionState(s);
      void load();
    },
    [load],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    setSessionState(null);
    setFamily(null);
    setAccount(null);
    setParent(null);
  }, []);

  const canDiscover = Boolean(
    account?.emailVerified &&
      account?.phoneVerified &&
      family?.verificationStatus === 'verified' &&
      account?.state === 'active',
  );

  const value = useMemo<AppState>(
    () => ({
      session,
      family,
      account,
      parent,
      loading,
      refresh: load,
      setSession,
      signOut,
      canDiscover,
    }),
    [session, family, account, parent, loading, load, setSession, signOut, canDiscover],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

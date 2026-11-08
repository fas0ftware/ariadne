import { useEffect, useState } from 'react';

// Current time that refreshes every `refreshMs`, so time-based UI stays up to date.
export function useNow(refreshMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return now;
}

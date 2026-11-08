import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { onDataChanged } from '../db/database';

// Runs `load` when the screen gains focus and whenever the database changes.
// Returns the latest result (undefined until the first load finishes).
export function useLoader<T>(load: () => Promise<T>): T | undefined {
  const [data, setData] = useState<T>();
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    loadRef.current().then(setData).catch(console.warn);
  }, []);

  useFocusEffect(reload);
  useEffect(() => onDataChanged(reload), [reload]);

  return data;
}

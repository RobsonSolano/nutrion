import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useActiveWorkoutStore } from '@/stores/useActiveWorkoutStore';

/**
 * Heartbeat do treino ativo — montar UMA vez num layout autenticado alto
 * (app/(tabs)/_layout.tsx). Persiste o "último instante vivo" a cada 5s
 * enquanto roda e ao ir pro background, pra congelar o tempo do pendente caso
 * o app seja morto. NÃO pausa no background (lock mantém o tempo rolando — D5).
 */
export function useActiveWorkoutHeartbeat() {
  const heartbeat = useActiveWorkoutStore((s) => s.heartbeat);

  useEffect(() => {
    const interval = setInterval(() => heartbeat(), 5000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') heartbeat();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [heartbeat]);
}

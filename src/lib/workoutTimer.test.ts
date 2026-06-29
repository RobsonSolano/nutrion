import { describe, it, expect } from 'vitest';
import {
  startWorkout,
  pause,
  resume,
  elapsedMs,
  touch,
  freezeForPending,
  statusOf,
  formatHMS,
  msToMinutes,
} from './workoutTimer';

const base = { routineId: 'r1', routineName: 'Peito A', day: '2026-06-29' };

describe('startWorkout', () => {
  it('WT01_start_inicia_rodando_zerado', () => {
    const s = startWorkout(base, 1000);
    expect(s.startedAt).toBe(1000);
    expect(s.runningSince).toBe(1000);
    expect(s.accumulatedMs).toBe(0);
    expect(s.lastSeenAt).toBe(1000);
    expect(statusOf(s)).toBe('running');
    expect(elapsedMs(s, 1000)).toBe(0);
  });
});

describe('elapsedMs', () => {
  it('WT03_elapsed_running_conta_do_runningSince', () => {
    const s = startWorkout(base, 1000);
    expect(elapsedMs(s, 6000)).toBe(5000);
  });

  it('WT03_elapsed_paused_fica_estavel', () => {
    const p = pause(startWorkout(base, 1000), 4000); // acumulou 3000
    expect(elapsedMs(p, 999999)).toBe(3000);
  });
});

describe('pause/resume', () => {
  it('WT02_pause_resume_soma_segmentos', () => {
    let s = startWorkout(base, 1000); // running desde 1000
    s = pause(s, 4000); // +3000 -> acc 3000
    s = resume(s, 10000); // running desde 10000
    expect(elapsedMs(s, 12000)).toBe(5000); // 3000 + 2000
  });

  it('WT02_pause_idempotente', () => {
    let s = pause(startWorkout(base, 1000), 4000); // acc 3000
    s = pause(s, 99999); // já pausado -> não muda o acumulado
    expect(elapsedMs(s, 99999)).toBe(3000);
  });

  it('WT02_resume_idempotente_quando_rodando', () => {
    const s = startWorkout(base, 1000);
    const r = resume(s, 5000); // já rodando -> sem efeito
    expect(elapsedMs(r, 6000)).toBe(5000);
  });
});

describe('freezeForPending', () => {
  it('WT09_freeze_congela_no_lastSeenAt', () => {
    let s = startWorkout(base, 1000); // running desde 1000
    s = touch(s, 9000); // heartbeat em 9000
    const frozen = freezeForPending(s);
    expect(statusOf(frozen)).toBe('paused');
    // tempo congelado = lastSeenAt - runningSince = 8000, independente de "now"
    expect(elapsedMs(frozen, 10_000_000)).toBe(8000);
  });

  it('WT09_freeze_de_estado_pausado_mantem', () => {
    const p = pause(startWorkout(base, 1000), 4000); // acc 3000, pausado
    const frozen = freezeForPending(p);
    expect(elapsedMs(frozen, 50000)).toBe(3000);
  });
});

describe('formatHMS', () => {
  it('WT04_formata_HH_MM_SS', () => {
    expect(formatHMS(0)).toBe('00:00:00');
    expect(formatHMS(5000)).toBe('00:00:05');
    expect(formatHMS(65000)).toBe('00:01:05');
    expect(formatHMS(3_661_000)).toBe('01:01:01');
    expect(formatHMS(90_000_000)).toBe('25:00:00'); // > 24h
    expect(formatHMS(-500)).toBe('00:00:00'); // clamp negativo
  });
});

describe('msToMinutes', () => {
  it('WT05_minutos_arredondado_minimo_1', () => {
    expect(msToMinutes(0)).toBe(1);
    expect(msToMinutes(30_000)).toBe(1); // 30s -> min 1
    expect(msToMinutes(60_000)).toBe(1); // 1min
    expect(msToMinutes(90_000)).toBe(2); // 1.5min -> 2
    expect(msToMinutes(150_000)).toBe(3); // 2.5min -> 3
  });
});

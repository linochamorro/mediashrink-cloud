/**
 * Datos demo del seed (F01-T04).
 *
 * Todo es ficticio y explícitamente marcado como tal (PR-02 / FR-04):
 * correos `@example.com`, nombres inventados y contraseñas de demostración
 * que NO son secretos (G-3). Los IDs son fijos para que la idempotencia sea
 * una propiedad de las claves, no una comprobación heurística.
 */

import type { Preset } from '../../../backend/src/contracts/index';

export interface DemoUserSpec {
  userId: string;
  email: string;
  password: string;
  displayName: string;
  jobId: string;
  preset: Preset;
  patternSeed: number;
}

export interface DemoImageSpec {
  imageId: string;
  label: string;
  width: number;
  height: number;
  patternSeed: number;
}

export interface DemoJobSpec {
  jobId: string;
  userId: string;
  preset: Preset;
  images: readonly DemoImageSpec[];
}

export interface SeedPlan {
  users: readonly DemoUserSpec[];
  jobs: readonly DemoJobSpec[];
}

function imagesFor(prefix: string, seed: number): readonly DemoImageSpec[] {
  return [
    { imageId: `img-${prefix}-01`, label: `Paisaje sintético ${prefix} 01`, width: 100, height: 100, patternSeed: seed * 10 + 1 },
    { imageId: `img-${prefix}-02`, label: `Paisaje sintético ${prefix} 02`, width: 100, height: 100, patternSeed: seed * 10 + 2 },
  ];
}

const USERS: readonly DemoUserSpec[] = [
  {
    userId: 'demo-user-ana',
    email: 'ana.demo@example.com',
    password: 'DemoAna2026!',
    displayName: 'Ana (usuario ficticio)',
    jobId: 'demo-job-ana',
    preset: 'BALANCED',
    patternSeed: 1,
  },
  {
    userId: 'demo-user-bruno',
    email: 'bruno.demo@example.com',
    password: 'DemoBruno2026!',
    displayName: 'Bruno (usuario ficticio)',
    jobId: 'demo-job-bruno',
    preset: 'HIGH',
    patternSeed: 2,
  },
  {
    userId: 'demo-user-carla',
    email: 'carla.demo@example.com',
    password: 'DemoCarla2026!',
    displayName: 'Carla (usuario ficticia)',
    jobId: 'demo-job-carla',
    preset: 'MAX_COMPRESSION',
    patternSeed: 3,
  },
];

/** Plan determinista: dos llamadas devuelven estructuras profundamente iguales. */
export function buildSeedPlan(): SeedPlan {
  const users = USERS.map((user) => ({ ...user }));
  const jobs: DemoJobSpec[] = users.map((user) => ({
    jobId: user.jobId,
    userId: user.userId,
    preset: user.preset,
    images: imagesFor(user.userId.replace('demo-user-', ''), user.patternSeed).map((image) => ({ ...image })),
  }));
  return { users, jobs };
}

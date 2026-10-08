import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.schema.js';

// Variables obligatorias mínimas para que el esquema acepte la configuración.
const base = {
  DATABASE_HOST: 'localhost',
  DATABASE_USER: 'zerobug',
  DATABASE_PASSWORD: 'secreto',
  DATABASE_NAME: 'zerobug',
};

describe('validateEnv — parámetros de reservas (D-001)', () => {
  it('usa 120 min de duración y 15 min de tolerancia por defecto', () => {
    const env = validateEnv(base);

    expect(env.RESERVATION_DURATION_MINUTES).toBe(120);
    expect(env.RESERVATION_NO_SHOW_TOLERANCE_MINUTES).toBe(15);
  });

  it('convierte a número los valores que llegan como texto desde .env', () => {
    const env = validateEnv({
      ...base,
      RESERVATION_DURATION_MINUTES: '90',
      RESERVATION_NO_SHOW_TOLERANCE_MINUTES: '0',
    });

    expect(env.RESERVATION_DURATION_MINUTES).toBe(90);
    expect(env.RESERVATION_NO_SHOW_TOLERANCE_MINUTES).toBe(0);
  });

  it.each([
    ['RESERVATION_DURATION_MINUTES', '10'],
    ['RESERVATION_DURATION_MINUTES', '721'],
    ['RESERVATION_DURATION_MINUTES', '90.5'],
    ['RESERVATION_NO_SHOW_TOLERANCE_MINUTES', '-1'],
    ['RESERVATION_NO_SHOW_TOLERANCE_MINUTES', 'quince'],
  ])('rechaza %s=%s y detiene el arranque', (name, value) => {
    expect(() => validateEnv({ ...base, [name]: value })).toThrow(name);
  });
});

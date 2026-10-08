import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from './index.js';

async function invalidProps(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(
    plainToInstance(CreateReservationDto, payload),
    {
      whitelist: true,
      forbidNonWhitelisted: true,
    },
  );
  return errors.map((e) => e.property).sort();
}

// Ayudas para armar fechas y horas relativas a "ahora": los tests no pueden
// usar fechas fijas porque con el tiempo se vuelven pasadas.
const pad = (n: number): string => String(n).padStart(2, '0');
const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatTime = (d: Date): string =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const valid = {
  customerName: 'Carlos Pérez',
  phone: '3001234567',
  email: 'carlos@example.com',
  date: formatDate(daysFromNow(1)),
  time: '19:00',
  guests: 4,
};

describe('CreateReservationDto', () => {
  it('acepta una reserva válida', async () => {
    expect(await invalidProps(valid)).toEqual([]);
  });

  it('exige todos los campos', async () => {
    expect(await invalidProps({})).toEqual([
      'customerName',
      'date',
      'email',
      'guests',
      'phone',
      'time',
    ]);
  });

  it('rechaza campos no declarados en el DTO', async () => {
    expect(await invalidProps({ ...valid, tableId: 'abc' })).toEqual([
      'tableId',
    ]);
  });

  describe('customerName', () => {
    it('recorta los espacios del inicio y del final', () => {
      const dto = plainToInstance(CreateReservationDto, {
        ...valid,
        customerName: '  Carlos Pérez  ',
      });
      expect(dto.customerName).toBe('Carlos Pérez');
    });

    it.each([
      ['vacío', ''],
      ['una sola letra', 'A'],
      ['solo espacios', '   '],
      ['más de 100 caracteres', 'a'.repeat(101)],
      ['un número', 123],
    ])('rechaza nombre %s', async (_label, customerName) => {
      expect(await invalidProps({ ...valid, customerName })).toEqual([
        'customerName',
      ]);
    });
  });

  describe('phone', () => {
    it.each(['3001234567', '+57 300 123 4567', '(601) 234-5678'])(
      'acepta el formato %s',
      async (phone) => {
        expect(await invalidProps({ ...valid, phone })).toEqual([]);
      },
    );

    it.each([
      ['vacío', ''],
      ['muy corto', '12345'],
      ['con letras', '300abc4567'],
      ['más de 15 dígitos', '1234567890123456'],
      ['un número sin comillas', 3001234567],
    ])('rechaza teléfono %s', async (_label, phone) => {
      expect(await invalidProps({ ...valid, phone })).toEqual(['phone']);
    });
  });

  describe('email', () => {
    it.each([
      ['vacío', ''],
      ['sin arroba', 'carlos.example.com'],
      ['sin dominio', 'carlos@'],
    ])('rechaza email %s', async (_label, email) => {
      expect(await invalidProps({ ...valid, email })).toEqual(['email']);
    });
  });

  describe('date (RN-042)', () => {
    it.each([
      ['con formato dd/mm/aaaa', '20/12/2030'],
      ['sin ceros', '2030-9-5'],
      ['una fecha que no existe', '2030-02-30'],
    ])('rechaza fecha %s', async (_label, date) => {
      expect(await invalidProps({ ...valid, date })).toEqual(['date']);
    });

    it('rechaza una fecha de ayer', async () => {
      const date = formatDate(daysFromNow(-1));
      expect(await invalidProps({ ...valid, date })).toEqual(['date']);
    });

    it('rechaza hoy con una hora que ya pasó', async () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(
        await invalidProps({
          ...valid,
          date: formatDate(past),
          time: formatTime(past),
        }),
      ).toEqual(['date']);
    });

    it('acepta hoy con una hora futura', async () => {
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
      expect(
        await invalidProps({
          ...valid,
          date: formatDate(future),
          time: formatTime(future),
        }),
      ).toEqual([]);
    });
  });

  describe('time', () => {
    it.each(['25:00', '19:60', '7pm', '19:00:00', ''])(
      'rechaza la hora "%s"',
      async (time) => {
        expect(await invalidProps({ ...valid, time })).toEqual(['time']);
      },
    );
  });

  describe('guests (RN-043)', () => {
    it.each([
      ['cero', 0],
      ['negativo', -2],
      ['decimal', 2.5],
      ['texto', '4'],
    ])('rechaza guests %s', async (_label, guests) => {
      expect(await invalidProps({ ...valid, guests })).toEqual(['guests']);
    });
  });
});

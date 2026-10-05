import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  const service = {
    checkAvailability: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [{ provide: ReservationsService, useValue: service }],
    }).compile();

    controller = moduleRef.get<ReservationsController>(ReservationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkAvailability', () => {
    it('delega la consulta de disponibilidad al servicio', async () => {
      const dto = { date: '2027-01-15', time: '19:00', guests: 4 };
      const expected = {
        available: true,
        date: dto.date,
        time: dto.time,
        guests: dto.guests,
        tables: [],
      };
      service.checkAvailability.mockResolvedValue(expected);

      const result = await controller.checkAvailability(dto);

      expect(service.checkAvailability).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});

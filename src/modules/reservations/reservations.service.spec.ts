import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ObjectLiteral } from 'typeorm';
import { BusinessRuleException } from '../../common/exceptions/index.js';
import { ReservationsService } from './reservations.service.js';
import { Reservation } from './entities/reservation.entity.js';
import { Table } from '../tables/entities/table.entity.js';
import { TableStatus, TableZone } from '../tables/enums/index.js';

type MockRepo<T extends ObjectLiteral = any> = Partial<Record<keyof Repository<T>, Mock>>;

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepo: MockRepo<Reservation>;
  let tableRepo: MockRepo<Table>;

  const mockTable: Table = {
    id: 'table-uuid-1',
    number: 1,
    capacity: 4,
    zone: TableZone.INTERIOR,
    status: TableStatus.AVAILABLE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    reservationRepo = {
      createQueryBuilder: vi.fn(),
    };

    tableRepo = {
      find: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationRepo,
        },
        {
          provide: getRepositoryToken(Table),
          useValue: tableRepo,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAvailability', () => {
    it('lanza BusinessRuleException si la hora tiene formato inválido', async () => {
      await expect(
        service.checkAvailability({ date: '2027-01-15', time: '1900', guests: 2 }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('lanza BusinessRuleException si la fecha/hora es en el pasado', async () => {
      await expect(
        service.checkAvailability({ date: '2000-01-01', time: '10:00', guests: 2 }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('retorna disponible false si no hay mesas operativas con capacidad suficiente', async () => {
      tableRepo.find!.mockResolvedValue([
        { ...mockTable, capacity: 2 },
      ]);

      const result = await service.checkAvailability({
        date: '2027-01-15',
        time: '19:00',
        guests: 4,
      });

      expect(result).toEqual({
        available: false,
        date: '2027-01-15',
        time: '19:00',
        guests: 4,
        tables: [],
      });
    });

    it('retorna mesas disponibles cuando no hay conflictos de reserva', async () => {
      tableRepo.find!.mockResolvedValue([mockTable]);

      const queryBuilderMock = {
        select: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      };
      reservationRepo.createQueryBuilder!.mockReturnValue(queryBuilderMock);

      const result = await service.checkAvailability({
        date: '2027-01-15',
        time: '19:00',
        guests: 4,
      });

      expect(result.available).toBe(true);
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0]).toEqual({
        id: mockTable.id,
        number: mockTable.number,
        capacity: mockTable.capacity,
        zone: mockTable.zone,
      });
    });

    it('descarta mesas con conflicto de reserva', async () => {
      tableRepo.find!.mockResolvedValue([mockTable]);

      const queryBuilderMock = {
        select: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([{ tableId: mockTable.id }]),
      };

      reservationRepo.createQueryBuilder!.mockReturnValue(queryBuilderMock);

      const result = await service.checkAvailability({
        date: '2027-01-15',
        time: '19:00',
        guests: 4,
      });

      expect(result.available).toBe(false);
      expect(result.tables).toHaveLength(0);
    });
  });
});

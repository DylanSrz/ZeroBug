import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReservations1790100000000 implements MigrationInterface {
  name = 'CreateReservations1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tableId" uuid NOT NULL,
        "startAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reservations_table" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_table_startAt_endAt" ON "reservations" ("tableId", "startAt", "endAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reservations_table_startAt_endAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
  }
}

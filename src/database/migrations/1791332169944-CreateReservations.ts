import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReservations1791332169944 implements MigrationInterface {
    name = 'CreateReservations1791332169944'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_table"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reservations_table_startAt_endAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "startAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "endAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "customerName" character varying(150) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "phone" character varying(30) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "email" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "date" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "time" TIME NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "guests" integer NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."reservations_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED')`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'PENDING'`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "confirmedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "checkedInAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "cancelledAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "noShowAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "completedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "reservations" ALTER COLUMN "tableId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_reservations_table_date" ON "reservations"  ("tableId", "date") `);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_42ee40914a466cb26141c81e878" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_42ee40914a466cb26141c81e878"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reservations_table_date"`);
        await queryRunner.query(`ALTER TABLE "reservations" ALTER COLUMN "tableId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "completedAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "noShowAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "cancelledAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "checkedInAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "confirmedAt"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."reservations_status_enum"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "guests"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "time"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "customerName"`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "endAt" TIMESTAMP WITH TIME ZONE NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "startAt" TIMESTAMP WITH TIME ZONE NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_reservations_table_startAt_endAt" ON "reservations" USING btree ("tableId", "startAt", "endAt") `);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_table" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}

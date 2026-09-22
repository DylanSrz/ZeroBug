// Este archivo es el formulario para "editar" una mesa que ya existe.
// Usa el mismo formulario de crear, pero todo se vuelve opcional
// (porque al editar no siempre quieres cambiar todos los campos).

import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTableDto } from './create-table.dto.js';

// PartialType: agarra CreateTableDto y hace que ningún campo sea obligatorio.
// Antes de eso, OmitType asegura que 'status' nunca esté aquí,
// porque cambiar el estado tiene su propio formulario aparte.
export class UpdateTableDto extends PartialType(
  OmitType(CreateTableDto, [] as const),
) {}
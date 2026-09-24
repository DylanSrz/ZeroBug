import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability } from '../../products/enums/index.js';

export class MenuProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Hamburguesa Clásica' })
  name: string;

  @ApiPropertyOptional({
    example: 'Hamburguesa con carne, queso y vegetales',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: 25000 })
  price: number;

  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  @ApiProperty({
    enum: ProductAvailability,
    example: ProductAvailability.AVAILABLE,
  })
  availability: ProductAvailability;
}

export class MenuCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Hamburguesas' })
  name: string;

  @ApiPropertyOptional({
    example: 'Hamburguesas de la casa',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ type: [MenuProductResponseDto] })
  products: MenuProductResponseDto[];
}

export class MenuResponseDto {
  @ApiProperty({ type: [MenuCategoryResponseDto] })
  categories: MenuCategoryResponseDto[];
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { MenuResponseDto } from './dto/menu-response.dto.js';
@Injectable()
export class MenuService {
  private readonly products: MenuResponseDto[] = [
    {
      id: 1,
      name: 'Hamburguesa clásica',
      description: 'Hamburguesa con carne, queso y vegetales',
      price: 25000,
      category: 'Hamburguesas',
      availability: 'AVAILABLE',
    },
    {
      id: 2,
      name: 'Pizza de pepperoni',
      description: 'Pizza con queso y pepperoni',
      price: 30000,
      category: 'Pizzas',
      availability: 'AVAILABLE',
    },
    {
      id: 3,
      name: 'Hamburguesa BBQ',
      description: 'Hamburguesa con salsa BBQ y queso',
      price: 28000,
      category: 'Hamburguesas',
      availability: 'UNAVAILABLE',
    },
  ];

  findProductById(id: number): MenuResponseDto {
    const product = this.products.find((product) => product.id === id);

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }
}

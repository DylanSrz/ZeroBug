import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MenuService } from './menu.service.js';
import { MenuResponseDto } from './dto/menu-response.dto.js';

@Controller('api/v1/menu')
export class MenuController {
    constructor(
    private readonly menuService: MenuService,
) {}

@Get('products/:id')
findProductById(
    @Param('id', ParseIntPipe) id: number,
    ): MenuResponseDto {
    return this.menuService.findProductById(id);
    }
}
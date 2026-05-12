import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from '@/user/user.service';
import { UpdateProfileDto } from '@/user/dto/update-profile.dto';
import { ApiGetUserMe } from '@/user/swagger/user.get.me.swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { ApiFindAllUsers } from '@/user/swagger/user.get.findAll.swagger';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, parsePageParam } from '@/common/constants';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiFindAllUsers()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNumber = parsePageParam(page, DEFAULT_PAGE);
    const limitNumber = parsePageParam(limit, DEFAULT_PAGE_SIZE);

    return this.userService.findAll(pageNumber, limitNumber);
  }

  @Get('me')
  @ApiGetUserMe()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Perfil do usuário obtido com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Erro desconhecido no servidor' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.userService.findById(req.user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Atualizar próprio perfil' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.id, dto);
  }
}

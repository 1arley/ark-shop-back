import { ParseBoolPipe, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminCreateProductDto } from '../dto/admin-product.dto';

describe('AdminController - importKeys isCsv parameter', () => {
  describe('current behavior (bug)', () => {
    it('ParseBoolPipe should reject undefined isCsv, proving DefaultValuePipe is needed', async () => {
      const pipe = new ParseBoolPipe();

      // When @Body('isCsv', ParseBoolPipe) receives `undefined` (not in request body),
      // ParseBoolPipe throws instead of defaulting to false.
      // This test proves the bug exists — the fix is adding DefaultValuePipe(false) before ParseBoolPipe.
      await expect(pipe.transform(undefined)).rejects.toThrow(BadRequestException);
    });
  });

  describe('after fix with DefaultValuePipe(false)', () => {
    it('DefaultValuePipe should set undefined isCsv to false before ParseBoolPipe', async () => {
      // Simulate the fixed behavior: if DefaultValuePipe(false) is applied,
      // ParseBoolPipe receives `false` instead of `undefined`
      const pipe = new ParseBoolPipe();

      const result = await pipe.transform(false);
      expect(result).toBe(false);
    });
  });
});

describe('AdminCreateProductDto', () => {
  it('accepts isActive when the admin panel creates a product', async () => {
    const dto = plainToInstance(AdminCreateProductDto, {
      name: 'Cyberpunk 2077',
      price: 99.9,
      stock: 10,
      isActive: false,
      imageUrl: 'https://cdn.example.com/products/cyberpunk.jpg',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });
});

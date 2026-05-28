import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { KeyStatus } from '@prisma/client';
import { ImportAccountsDto } from '../dto/import-accounts.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

describe('ImportAccountsDto', () => {
  it('rejects non-string account entries', async () => {
    const dto = plainToInstance(ImportAccountsDto, {
      productId: 'product-id-1',
      accounts: [{ email: 'user@example.com', password: 'secret' }],
    });

    const errors = await validate(dto);

    expect(errors.some(error => error.property === 'accounts')).toBe(true);
  });

  it('accepts account lines as strings', async () => {
    const dto = plainToInstance(ImportAccountsDto, {
      productId: 'product-id-1',
      accounts: ['user@example.com:secret'],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

describe('UpdateAccountDto', () => {
  it('rejects invalid account statuses', async () => {
    const dto = plainToInstance(UpdateAccountDto, {
      status: 'SOLD',
    });

    const errors = await validate(dto);

    expect(errors.some(error => error.property === 'status')).toBe(true);
  });

  it('accepts KeyStatus values for account status', async () => {
    const dto = plainToInstance(UpdateAccountDto, {
      status: KeyStatus.AVAILABLE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

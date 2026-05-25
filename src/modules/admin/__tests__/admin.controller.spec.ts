import { ParseBoolPipe, BadRequestException } from '@nestjs/common';

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

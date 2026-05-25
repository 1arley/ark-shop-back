import { Injectable, BadRequestException } from '@nestjs/common';
import { CSV_MAX_FILE_SIZE, CSV_MAX_LINES } from '@/common/constants';

export interface ParsedProduct {
  name: string;
  price: number;
  platform: string;
  region?: string;
  timestamp?: string;
}

@Injectable()
export class CsvParserService {
  /**
   * Parse CSV content from Google Sheets export format
   * The CSV has a specific format with columns for each platform (XBOX, STEAM/PC, NINTENDO, PLAYSTATION)
   * Each platform column has sub-columns: timestamp, name, price
   */
  parse(csvContent: string): ParsedProduct[] {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new BadRequestException('CSV content is required and must be a string');
    }

    // ✅ Validação de tamanho (CRÍTICO: Previne DoS)
    if (csvContent.length > CSV_MAX_FILE_SIZE) {
      throw new BadRequestException(
        `CSV content exceeds maximum size of ${CSV_MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    const lines = csvContent.trim().split('\n');

    // ✅ Validação de número de linhas (CRÍTICO: Previne sobrecarga)
    if (lines.length > CSV_MAX_LINES) {
      throw new BadRequestException(
        `CSV must not exceed ${CSV_MAX_LINES.toLocaleString()} lines (found ${lines.length.toLocaleString()})`,
      );
    }

    if (lines.length < 3) {
      throw new BadRequestException(
        'CSV must have at least 3 lines (header, sub-header, and data)',
      );
    }

    // Parse header lines to identify platform columns
    const headerLine = lines[0] || '';
    const subHeaderLine = lines[1] || '';

    // Parse all data lines into rows
    const rows = this.parseCsvLines(lines.slice(2));

    // Identify platform columns from BOTH header and sub-header for accurate alignment
    const platforms = this.extractPlatforms(headerLine, subHeaderLine);

    const products: ParsedProduct[] = [];

    // Process each row
    for (const row of rows) {
      // For each platform, extract the product data
      for (const platform of platforms) {
        const platformIndex = platform.columnIndex;

        // Check if this platform has data in this row
        if (platformIndex + 2 < row.length) {
          const timestamp = row[platformIndex]?.trim() || '';
          const name = row[platformIndex + 1]?.trim() || '';
          const priceStr = row[platformIndex + 2]?.trim() || '';

          // Only add if we have a valid name and price
          if (name && priceStr && !name.includes('Carimbo de data/hora')) {
            const price = this.parsePrice(priceStr);

            if (price > 0) {
              // ✅ Sanitize input (CRÍTICO: Previne XSS)
              const sanitizedName = this.sanitizeInput(name);

              // Extract region from name if present (e.g., "game(xbox-europa)")
              const region = this.extractRegion(sanitizedName);

              products.push({
                name: this.cleanName(sanitizedName),
                price,
                platform: platform.name,
                region,
                timestamp: timestamp ? this.sanitizeInput(timestamp) : undefined,
              });
            }
          }
        }
      }
    }

    return products;
  }

  /**
   * Parse CSV lines handling quoted values and commas within quotes
   */
  private parseCsvLines(lines: string[]): string[][] {
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    });
  }

  /**
   * Extract platform information from header and sub-header lines
   * Handles both formats:
   * - Format A: XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION (3 cols each)
   * - Format B: ,XBOX,,,,STEAM/PC,,,,NINTENDO E-SHOP,,,,PLAYSTATION, (4 cols each with gaps)
   *
   * Uses sub-header line for accurate column alignment since it matches data rows structure.
   */
  private extractPlatforms(
    headerLine: string,
    subHeaderLine: string,
  ): Array<{ name: string; columnIndex: number }> {
    const platforms: Array<{ name: string; columnIndex: number }> = [];

    // Parse sub-header using CSV parser (handles quoted values)
    // Sub-header is more reliable for column alignment since it matches data structure
    const subHeaderParts = this.parseCsvLines([subHeaderLine])[0] || [];

    // Find platform names from the first header line
    const headerParts = this.parseCsvLines([headerLine])[0] || [];

    // Identify platform names from header
    const platformNames: string[] = [];
    for (const part of headerParts) {
      const trimmed = part?.trim() || '';
      if (trimmed && !trimmed.includes('Carimbo de data/hora')) {
        const isPlatform = /^(XBOX|STEAM|PC|NINTENDO|PLAYSTATION|PS[45]?)/i.test(trimmed);
        if (isPlatform) {
          platformNames.push(trimmed);
        }
      }
    }

    // If no platforms found in header, try to detect from sub-header pattern
    if (platformNames.length === 0) {
      // Count "Carimbo de data/hora" occurrences to determine number of platforms
      const timestampCols = subHeaderParts.filter(p => p?.trim() === 'Carimbo de data/hora').length;

      if (timestampCols > 0) {
        // Use default platform names
        const defaultNames = ['XBOX', 'STEAM/PC', 'NINTENDO E-SHOP', 'PLAYSTATION'] as const;
        for (let i = 0; i < Math.min(timestampCols, defaultNames.length); i++) {
          platformNames.push(defaultNames[i]!);
        }
      }
    }

    // Now find column indices from sub-header
    // Each platform starts with "Carimbo de data/hora" column
    let nameIndex = 0;
    for (let i = 0; i < subHeaderParts.length; i++) {
      const trimmed = subHeaderParts[i]?.trim() || '';
      if (trimmed === 'Carimbo de data/hora' && nameIndex < platformNames.length) {
        platforms.push({
          name: platformNames[nameIndex]!,
          columnIndex: i,
        });
        nameIndex++;
      }
    }

    // Fallback: if still no platforms, use default positions
    if (platforms.length === 0) {
      const defaultPlatforms = ['XBOX', 'STEAM/PC', 'NINTENDO E-SHOP', 'PLAYSTATION'];
      defaultPlatforms.forEach((platform, index) => {
        platforms.push({
          name: platform,
          columnIndex: index * 3,
        });
      });
    }

    return platforms;
  }

  /**
   * Parse Brazilian Real price format (R$ 1.234,56 or R$1.234,56)
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) {
      return 0;
    }

    try {
      // Strip currency symbols (R$, $, €, £, etc.) and whitespace
      let cleaned = priceStr.replace(/[R$\s€£]/g, '').trim();
      if (!cleaned) return 0;

      // Locale-aware decimal detection:
      // Google Sheets CSV prices can come in different locale formats:
      //   BRL: 1.234,56  (dot=thousands, comma=decimal)
      //   USD: 1,234.56  (comma=thousands, dot=decimal)
      //   INT: 1234.56   (dot=decimal, no thousands separator)
      //
      // Strategy: the separator that appears LAST is always the decimal marker.

      const lastDot = cleaned.lastIndexOf('.');
      const lastComma = cleaned.lastIndexOf(',');

      if (lastDot !== -1 && lastComma !== -1) {
        // Both separators present → whichever is last is the decimal separator
        if (lastDot > lastComma) {
          // US format: 1,234.56 — remove commas, keep dot
          cleaned = cleaned.replace(/,/g, '');
        } else {
          // Brazilian format: 1.234,56 — remove dots, replace comma with dot
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
      } else if (lastComma !== -1) {
        // Only comma — detect if it's a decimal or thousands separator
        const digitsAfterComma = cleaned.length - lastComma - 1;
        if (digitsAfterComma <= 2) {
          // 1-2 digits after comma → decimal separator (BRL format like 100,50)
          cleaned = cleaned.replace(',', '.');
        } else {
          // 3+ digits after comma → thousands separator (like 1,234 → 1234)
          cleaned = cleaned.replace(/,/g, '');
        }
      }
      // else only dot (or no separator): it's already in standard format

      const price = parseFloat(cleaned);
      return isNaN(price) ? 0 : price;
    } catch {
      return 0;
    }
  }

  /**
   * Extract region from product name if present
   * e.g., "Final fantasy xvi(xbox-europa)" -> "eu"
   */
  private extractRegion(name: string): string | undefined {
    const match = name.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const regionStr = match[1].toLowerCase();

      if (
        regionStr.includes('brasil') ||
        regionStr.includes('brazil') ||
        regionStr.includes('br')
      ) {
        return 'br';
      }
      if (regionStr.includes('argentina') || regionStr.includes('ar')) {
        return 'ar';
      }
      if (
        regionStr.includes('europa') ||
        regionStr.includes('europe') ||
        regionStr.includes('eu')
      ) {
        return 'eu';
      }
      if (regionStr.includes('latam') || regionStr.includes('latina')) {
        return 'latam';
      }
      if (regionStr.includes('global')) {
        return 'global';
      }
      if (regionStr.includes('conta')) {
        return 'conta';
      }
    }

    return undefined;
  }

  /**
   * Clean product name by removing platform/region info in parentheses
   */
  private cleanName(name: string): string {
    // Remove content in parentheses but keep the base name
    return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   * Removes HTML tags, dangerous characters, and limits length
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';

    // Remove HTML tags (previne XSS)
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove caracteres perigosos (previne injeção)
    sanitized = sanitized.replace(/[<>"'&]/g, '');

    // Limita tamanho (previne overflow)
    return sanitized.substring(0, 500);
  }
}

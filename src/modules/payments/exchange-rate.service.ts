import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeCurrencyCode } from './currency-code.utils.js';

@Injectable()
export class ExchangeRateService {
  constructor(private readonly configService: ConfigService) {}

  private getValue(key: string) {
    return this.configService.get<string>(key) ?? null;
  }

  private getBaseUrl() {
    return (
      this.getValue('EXCHANGE_RATE_API_BASE_URL') ??
      'https://api.frankfurter.dev/v2'
    ).replace(/\/+$/, '');
  }

  async getRate(baseCurrency: string, quoteCurrency: string) {
    const base = normalizeCurrencyCode(baseCurrency);
    const quote = normalizeCurrencyCode(quoteCurrency);

    if (!base || !quote) {
      throw new BadRequestException('Base and quote currency are required');
    }

    if (base === quote) {
      return 1;
    }

    const response = await fetch(
      `${this.getBaseUrl()}/rate/${base}/${quote}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { rate?: number; message?: string }
      | null;

    if (response.status === 404 || response.status === 422) {
      throw new BadRequestException(
        payload?.message ??
          `Exchange rate is not available for ${base} to ${quote}`,
      );
    }

    if (!response.ok || typeof payload?.rate !== 'number') {
      throw new InternalServerErrorException(
        payload?.message ?? 'Unable to fetch exchange rate',
      );
    }

    return payload.rate;
  }
}

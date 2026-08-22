import { TenantService } from './tenant.service.js';

describe('TenantService.getManagerOverview', () => {
  const tenantId = 'tenant-1';

  const makeService = () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      discount: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: jest.fn(),
      },
    } as any;

    const exchangeRates = {
      tryGetRate: jest.fn(),
    } as any;

    const service = new TenantService(prisma, exchangeRates);

    return { service, prisma };
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns daily overview with current day sales and previous history', async () => {
    jest.setSystemTime(new Date('2026-06-28T10:30:00.000Z').getTime());
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(3);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 100, createdAt: new Date('2026-06-26T08:00:00.000Z') },
      { amount: 80, createdAt: new Date('2026-06-26T11:00:00.000Z') },
      { amount: 210, createdAt: new Date('2026-06-27T09:00:00.000Z') },
      { amount: 120, createdAt: new Date('2026-06-28T08:00:00.000Z') },
      { amount: 125.5, createdAt: new Date('2026-06-28T09:30:00.000Z') },
    ]);

    const result = await service.getManagerOverview(tenantId, 'MANAGER', 'daily');

    expect(result.range).toBe('daily');
    expect(result.sales).toBe(245.5);
    expect(result.transactions).toBe(2);
    expect(result.overallTotalSales).toBe(635.5);
    expect(result.currency).toBe('USD');
  });

  it('returns weekly overview with current week and history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z').getTime());
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(1);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 300, createdAt: new Date('2026-06-03T08:00:00.000Z') },
      { amount: 400, createdAt: new Date('2026-06-11T08:00:00.000Z') },
      { amount: 500, createdAt: new Date('2026-06-18T08:00:00.000Z') },
      { amount: 150, createdAt: new Date('2026-06-23T08:00:00.000Z') },
      { amount: 200, createdAt: new Date('2026-06-24T08:00:00.000Z') },
    ]);

    const result = await service.getManagerOverview(tenantId, 'SUPERVISOR', 'weekly');

    expect(result.range).toBe('weekly');
    expect(result.sales).toBe(350);
    expect(result.transactions).toBe(2);
    expect(result.overallTotalSales).toBe(1550);
  });

  it('returns monthly overview with current month and history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z').getTime());
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(2);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 220, createdAt: new Date('2026-02-10T08:00:00.000Z') },
      { amount: 330, createdAt: new Date('2026-03-10T08:00:00.000Z') },
      { amount: 440, createdAt: new Date('2026-05-10T08:00:00.000Z') },
      { amount: 120, createdAt: new Date('2026-06-12T08:00:00.000Z') },
      { amount: 180, createdAt: new Date('2026-06-21T08:00:00.000Z') },
    ]);

    const result = await service.getManagerOverview(tenantId, 'MANAGER', 'monthly');

    expect(result.range).toBe('monthly');
    expect(result.sales).toBe(300);
    expect(result.transactions).toBe(2);
    expect(result.overallTotalSales).toBe(1290);
  });

  it('returns yearly overview with current year and history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z').getTime());
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(4);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 1200, createdAt: new Date('2023-06-10T08:00:00.000Z') },
      { amount: 2400, createdAt: new Date('2024-06-10T08:00:00.000Z') },
      { amount: 3600, createdAt: new Date('2025-06-10T08:00:00.000Z') },
      { amount: 1800, createdAt: new Date('2026-03-10T08:00:00.000Z') },
      { amount: 2200, createdAt: new Date('2026-05-10T08:00:00.000Z') },
    ]);

    const result = await service.getManagerOverview(tenantId, 'SUPERVISOR', 'yearly');

    expect(result.range).toBe('yearly');
    expect(result.sales).toBe(4000);
    expect(result.transactions).toBe(2);
    expect(result.overallTotalSales).toBe(11200);
  });

  it('returns empty history and zero current when there are no payments', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z').getTime());
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(0);
    prisma.payment.findMany.mockResolvedValue([]);

    const result = await service.getManagerOverview(tenantId, 'MANAGER', 'daily');

    expect(result.range).toBe('daily');
    expect(result.sales).toBe(0);
    expect(result.transactions).toBe(0);
    expect(result.overallTotalSales).toBe(0);
    expect(result.history).toEqual([]);
  });
});

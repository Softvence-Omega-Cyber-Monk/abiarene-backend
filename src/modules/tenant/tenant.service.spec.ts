import { TenantService } from './tenant.service';

describe('TenantService.getManagerOverview', () => {
  const tenantId = 'tenant-1';

  const makeService = () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      discount: {
        count: jest.fn(),
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

  it('returns daily graph with current day and previous daily history', async () => {
    jest.setSystemTime(new Date('2026-06-28T10:30:00.000Z'));
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

    const result = await service.getManagerOverview(tenantId, 'daily');

    expect(result.dailySales).toBe(245.5);
    expect(result.sales.today).toBe(245.5);
    expect(result.sales.previousDay).toBe(210);
    expect(result.transactions.total).toBe(5);
    expect(result.transactions.today).toBe(2);
    expect(result.transactions.previousDay).toBe(1);
    expect(result.graph.range).toBe('daily');
    expect(result.graph.current).toMatchObject({
      label: '2026-06-28',
      value: 245.5,
      transactionCount: 2,
    });
    expect(result.graph.history).toHaveLength(2);
    expect(result.graph.history[0]).toMatchObject({
      label: '2026-06-26',
      value: 180,
      transactionCount: 2,
    });
    expect(result.graph.history[1]).toMatchObject({
      label: '2026-06-27',
      value: 210,
      transactionCount: 1,
    });
  });

  it('returns weekly graph with current week and previous weekly history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z'));
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

    const result = await service.getManagerOverview(tenantId, 'weekly');

    expect(result.graph.range).toBe('weekly');
    expect(result.graph.current).toMatchObject({
      label: '2026-W26',
      value: 350,
      transactionCount: 2,
    });
    expect(result.graph.history.map((item) => item.label)).toEqual([
      '2026-W23',
      '2026-W24',
      '2026-W25',
    ]);
    expect(result.graph.history.map((item) => item.value)).toEqual([
      300, 400, 500,
    ]);
  });

  it('returns monthly graph with current month and previous monthly history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z'));
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

    const result = await service.getManagerOverview(tenantId, 'monthly');

    expect(result.graph.range).toBe('monthly');
    expect(result.graph.current).toMatchObject({
      label: '2026-06',
      value: 300,
      transactionCount: 2,
    });
    expect(result.graph.history.map((item) => item.label)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ]);
    expect(result.graph.history.map((item) => item.value)).toEqual([
      220, 330, 0, 440,
    ]);
  });

  it('returns yearly graph with current year and previous yearly history', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z'));
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

    const result = await service.getManagerOverview(tenantId, 'yearly');

    expect(result.graph.range).toBe('yearly');
    expect(result.graph.current).toMatchObject({
      label: '2026',
      value: 4000,
      transactionCount: 2,
    });
    expect(result.graph.history.map((item) => item.label)).toEqual([
      '2023',
      '2024',
      '2025',
    ]);
    expect(result.graph.history.map((item) => item.value)).toEqual([
      1200, 2400, 3600,
    ]);
  });

  it('returns empty history and zero current when there are no payments', async () => {
    jest.setSystemTime(new Date('2026-06-24T10:30:00.000Z'));
    const { service, prisma } = makeService();

    prisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId })
      .mockResolvedValueOnce({ currencyCode: 'USD' });
    prisma.discount.count.mockResolvedValue(0);
    prisma.payment.findMany.mockResolvedValue([]);

    const result = await service.getManagerOverview(tenantId, 'daily');

    expect(result.dailySales).toBe(0);
    expect(result.transactions.total).toBe(0);
    expect(result.graph.current).toMatchObject({
      label: '2026-06-24',
      value: 0,
      transactionCount: 0,
    });
    expect(result.graph.history).toEqual([]);
  });
});

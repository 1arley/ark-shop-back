import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics.service';
import {
  Counter as _Counter,
  Histogram as _Histogram,
  Gauge as _Gauge,
  register as _register,
} from 'prom-client';

// Mock prom-client
jest.mock('prom-client', () => {
  const createMockCounter = () => ({
    inc: jest.fn(),
  });

  const createMockHistogram = () => ({
    observe: jest.fn(),
  });

  const createMockGauge = () => ({
    set: jest.fn(),
  });

  const mockRegister = {
    clear: jest.fn(),
    metrics: jest
      .fn()
      .mockResolvedValue('# HELP test_metric Test\n# TYPE test_metric counter\ntest_metric 0'),
  };

  const MockCounter = jest.fn(() => createMockCounter());
  const MockHistogram = jest.fn(() => createMockHistogram());
  const MockGauge = jest.fn(() => createMockGauge());

  return {
    Counter: MockCounter,
    Histogram: MockHistogram,
    Gauge: MockGauge,
    register: mockRegister,
  };
});

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  describe('onModuleInit', () => {
    it('deve inicializar e registrar todas as m\u00e9tricas', () => {
      service.onModuleInit();

      const { register: mockRegister } = jest.requireMock('prom-client');
      expect(mockRegister.clear).toHaveBeenCalled();
    });

    it('deve registrar todos os counters (orders + payments + coupons)', () => {
      service.onModuleInit();

      const { Counter } = jest.requireMock('prom-client');
      // 3 orders + 3 payments + 3 coupons = 9 counters total
      expect(Counter).toHaveBeenCalledTimes(9);
    });

    it('deve registrar todos os histograms', () => {
      service.onModuleInit();

      const { Histogram } = jest.requireMock('prom-client');
      expect(Histogram).toHaveBeenCalledTimes(2); // orderDeliveryDuration, paymentProcessingDuration
    });

    it('deve registrar o gauge de active users', () => {
      service.onModuleInit();

      const { Gauge } = jest.requireMock('prom-client');
      expect(Gauge).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementOrdersCreated', () => {
    it('deve incrementar counter de orders created', () => {
      service.onModuleInit();
      service.incrementOrdersCreated();

      const { Counter } = jest.requireMock('prom-client');
      // ordersCreatedCounter \u00e9 o primeiro Counter criado (index 0)
      const ordersCreatedCounter = Counter.mock.results[0].value;
      expect(ordersCreatedCounter.inc).toHaveBeenCalled();
    });
  });

  describe('incrementOrdersDelivered', () => {
    it('deve incrementar counter de orders delivered', () => {
      service.onModuleInit();
      service.incrementOrdersDelivered();

      const { Counter } = jest.requireMock('prom-client');
      // ordersDeliveredCounter \u00e9 o segundo Counter criado (index 1)
      const ordersDeliveredCounter = Counter.mock.results[1].value;
      expect(ordersDeliveredCounter.inc).toHaveBeenCalled();
    });
  });

  describe('incrementOrdersCancelled', () => {
    it('deve incrementar counter de orders cancelled', () => {
      service.onModuleInit();
      service.incrementOrdersCancelled();

      const { Counter } = jest.requireMock('prom-client');
      // ordersCancelledCounter \u00e9 o terceiro Counter criado (index 2)
      const ordersCancelledCounter = Counter.mock.results[2].value;
      expect(ordersCancelledCounter.inc).toHaveBeenCalled();
    });
  });

  describe('observeOrderDelivery', () => {
    it('deve observar dura\u00e7\u00e3o de delivery', () => {
      service.onModuleInit();
      service.observeOrderDelivery(1.5);

      const { Histogram } = jest.requireMock('prom-client');
      // orderDeliveryDuration \u00e9 o primeiro Histogram criado (index 0)
      const orderHistogram = Histogram.mock.results[0].value;
      expect(orderHistogram.observe).toHaveBeenCalledWith(1.5);
    });
  });

  describe('incrementPaymentsApproved', () => {
    it('deve incrementar counter de payments approved com provider e method', () => {
      service.onModuleInit();
      service.incrementPaymentsApproved('asaas', 'credit_card');

      const { Counter } = jest.requireMock('prom-client');
      // paymentsApprovedCounter \u00e9 o quarto Counter (index 3)
      const paymentsApprovedCounter = Counter.mock.results[3].value;
      expect(paymentsApprovedCounter.inc).toHaveBeenCalledWith({
        provider: 'asaas',
        method: 'credit_card',
      });
    });
  });

  describe('incrementPaymentsRejected', () => {
    it('deve incrementar counter de payments rejected com provider e reason', () => {
      service.onModuleInit();
      service.incrementPaymentsRejected('asaas', 'insufficient_funds');

      const { Counter } = jest.requireMock('prom-client');
      // paymentsRejectedCounter \u00e9 o quinto Counter (index 4)
      const paymentsRejectedCounter = Counter.mock.results[4].value;
      expect(paymentsRejectedCounter.inc).toHaveBeenCalledWith({
        provider: 'asaas',
        reason: 'insufficient_funds',
      });
    });
  });

  describe('incrementPaymentsRefunded', () => {
    it('deve incrementar counter de payments refunded', () => {
      service.onModuleInit();
      service.incrementPaymentsRefunded();

      const { Counter } = jest.requireMock('prom-client');
      // paymentsRefundedCounter \u00e9 o sexto Counter (index 5)
      const paymentsRefundedCounter = Counter.mock.results[5].value;
      expect(paymentsRefundedCounter.inc).toHaveBeenCalled();
    });
  });

  describe('observePaymentProcessing', () => {
    it('deve observar dura\u00e7\u00e3o de processamento de pagamento', () => {
      service.onModuleInit();
      service.observePaymentProcessing(2.5);

      const { Histogram } = jest.requireMock('prom-client');
      // paymentProcessingDuration \u00e9 o segundo Histogram (index 1)
      const paymentHistogram = Histogram.mock.results[1].value;
      expect(paymentHistogram.observe).toHaveBeenCalledWith(2.5);
    });
  });

  describe('incrementCouponsApplied', () => {
    it('deve incrementar counter de coupons applied com coupon_code', () => {
      service.onModuleInit();
      service.incrementCouponsApplied('PROMO10');

      const { Counter } = jest.requireMock('prom-client');
      // couponsAppliedCounter \u00e9 o s\u00e9timo Counter (index 6)
      const couponsAppliedCounter = Counter.mock.results[6].value;
      expect(couponsAppliedCounter.inc).toHaveBeenCalledWith({ coupon_code: 'PROMO10' });
    });
  });

  describe('incrementCouponsValidated', () => {
    it('deve incrementar counter de coupons validated', () => {
      service.onModuleInit();
      service.incrementCouponsValidated();

      const { Counter } = jest.requireMock('prom-client');
      // couponsValidatedCounter \u00e9 o oitavo Counter (index 7)
      const couponsValidatedCounter = Counter.mock.results[7].value;
      expect(couponsValidatedCounter.inc).toHaveBeenCalled();
    });
  });

  describe('incrementCouponsRejected', () => {
    it('deve incrementar counter de coupons rejected com reason', () => {
      service.onModuleInit();
      service.incrementCouponsRejected('expired');

      const { Counter } = jest.requireMock('prom-client');
      // couponsRejectedCounter \u00e9 o nono Counter (index 8)
      const couponsRejectedCounter = Counter.mock.results[8].value;
      expect(couponsRejectedCounter.inc).toHaveBeenCalledWith({ reason: 'expired' });
    });
  });

  describe('setActiveUsers', () => {
    it('deve definir o gauge de active users', () => {
      service.onModuleInit();
      service.setActiveUsers(42);

      const { Gauge } = jest.requireMock('prom-client');
      const activeUsersGauge = Gauge.mock.results[0].value;
      expect(activeUsersGauge.set).toHaveBeenCalledWith(42);
    });

    it('deve definir o gauge com zero', () => {
      service.onModuleInit();
      service.setActiveUsers(0);

      const { Gauge } = jest.requireMock('prom-client');
      const activeUsersGauge = Gauge.mock.results[0].value;
      expect(activeUsersGauge.set).toHaveBeenCalledWith(0);
    });
  });
});

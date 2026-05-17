import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  // ─── Order Metrics ──────────────────────────────────────────────
  private ordersCreatedCounter!: Counter;
  private ordersDeliveredCounter!: Counter;
  private ordersCancelledCounter!: Counter;
  private orderDeliveryDuration!: Histogram;

  // ─── Payment Metrics ────────────────────────────────────────────
  private paymentsApprovedCounter!: Counter;
  private paymentsRejectedCounter!: Counter;
  private paymentsRefundedCounter!: Counter;
  private paymentProcessingDuration!: Histogram;

  // ─── Coupon Metrics ─────────────────────────────────────────────
  private couponsAppliedCounter!: Counter;
  private couponsValidatedCounter!: Counter;
  private couponsRejectedCounter!: Counter;

  // ─── System Metrics ─────────────────────────────────────────────
  private activeUsersGauge!: Gauge;

  onModuleInit() {
    this.registerMetrics();
  }

  private registerMetrics() {
    // Clear existing metrics to avoid duplicates on hot reload
    register.clear();

    // ─── Orders ───────────────────────────────────────────────────
    this.ordersCreatedCounter = new Counter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
    });

    this.ordersDeliveredCounter = new Counter({
      name: 'orders_delivered_total',
      help: 'Total number of orders delivered',
    });

    this.ordersCancelledCounter = new Counter({
      name: 'orders_cancelled_total',
      help: 'Total number of orders cancelled',
    });

    this.orderDeliveryDuration = new Histogram({
      name: 'order_delivery_duration_seconds',
      help: 'Time taken to deliver an order (key reservation)',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    // ─── Payments ─────────────────────────────────────────────────
    this.paymentsApprovedCounter = new Counter({
      name: 'payments_approved_total',
      help: 'Total number of approved payments',
      labelNames: ['provider', 'method'],
    });

    this.paymentsRejectedCounter = new Counter({
      name: 'payments_rejected_total',
      help: 'Total number of rejected payments',
      labelNames: ['provider', 'reason'],
    });

    this.paymentsRefundedCounter = new Counter({
      name: 'payments_refunded_total',
      help: 'Total number of refunded payments',
    });

    this.paymentProcessingDuration = new Histogram({
      name: 'payment_processing_duration_seconds',
      help: 'Time taken to process a payment',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    // ─── Coupons ──────────────────────────────────────────────────
    this.couponsAppliedCounter = new Counter({
      name: 'coupons_applied_total',
      help: 'Total number of coupons applied to orders',
      labelNames: ['coupon_code'],
    });

    this.couponsValidatedCounter = new Counter({
      name: 'coupons_validated_total',
      help: 'Total number of coupon validations',
    });

    this.couponsRejectedCounter = new Counter({
      name: 'coupons_rejected_total',
      help: 'Total number of rejected coupon validations',
      labelNames: ['reason'],
    });

    // ─── System ───────────────────────────────────────────────────
    this.activeUsersGauge = new Gauge({
      name: 'active_users_count',
      help: 'Number of active users (updated periodically)',
    });
  }

  // ─── Order helpers ──────────────────────────────────────────────
  incrementOrdersCreated() {
    this.ordersCreatedCounter.inc();
  }

  incrementOrdersDelivered() {
    this.ordersDeliveredCounter.inc();
  }

  incrementOrdersCancelled() {
    this.ordersCancelledCounter.inc();
  }

  observeOrderDelivery(durationSeconds: number) {
    this.orderDeliveryDuration.observe(durationSeconds);
  }

  // ─── Payment helpers ────────────────────────────────────────────
  incrementPaymentsApproved(provider: string, method: string) {
    this.paymentsApprovedCounter.inc({ provider, method });
  }

  incrementPaymentsRejected(provider: string, reason: string) {
    this.paymentsRejectedCounter.inc({ provider, reason });
  }

  incrementPaymentsRefunded() {
    this.paymentsRefundedCounter.inc();
  }

  observePaymentProcessing(durationSeconds: number) {
    this.paymentProcessingDuration.observe(durationSeconds);
  }

  // ─── Coupon helpers ─────────────────────────────────────────────
  incrementCouponsApplied(couponCode: string) {
    this.couponsAppliedCounter.inc({ coupon_code: couponCode });
  }

  incrementCouponsValidated() {
    this.couponsValidatedCounter.inc();
  }

  incrementCouponsRejected(reason: string) {
    this.couponsRejectedCounter.inc({ reason });
  }

  // ─── System helpers ─────────────────────────────────────────────
  setActiveUsers(count: number) {
    this.activeUsersGauge.set(count);
  }
}

export const FINAL_STATUSES = [
  'PAYMENT_FAILED',
  'CANCELLED',
  'COMPLETED',
] as const;

export const ORDER_SNAPSHOT_FIELDS = [
  'productName',
  'sizeName',
  'unitPrice',
  'quantity',
  'lineTotal',
] as const;

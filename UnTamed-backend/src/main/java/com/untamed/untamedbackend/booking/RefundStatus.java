package com.untamed.untamedbackend.booking;

public enum RefundStatus {
    NONE,
    NOT_REFUNDABLE,
    REFUND_PENDING,
    REFUNDED,
    PARTIALLY_REFUNDED,
    REFUND_FAILED
}
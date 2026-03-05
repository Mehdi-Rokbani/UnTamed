package com.untamed.untamedbackend.payment;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class KonnectCreatePaymentResponse {
    private String payUrl;
    private String paymentRef;
}
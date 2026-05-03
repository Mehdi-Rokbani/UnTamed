package com.untamed.untamedbackend.payment.Konnect_disabled;

import lombok.Data;

@Data
public class KonnectInitResponse {
    private String payUrl;
    private String paymentRef;
}
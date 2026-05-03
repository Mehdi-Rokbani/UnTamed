package com.untamed.untamedbackend.payment.Konnect_disabled;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class KonnectVerifyResponse {
    private String status; // "pending" | "succeeded" | "failed"
}
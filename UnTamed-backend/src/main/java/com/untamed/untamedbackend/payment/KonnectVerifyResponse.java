package com.untamed.untamedbackend.payment;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class KonnectVerifyResponse {
    private String status; // "pending" | "succeeded" | "failed"
}
package com.untamed.untamedbackend.service;

public class AccountSuspendedException extends RuntimeException {

    private final String appealToken;
    private final long expiresInSeconds;

    public AccountSuspendedException(String appealToken, long expiresInSeconds) {
        super("Your account has been suspended.");
        this.appealToken = appealToken;
        this.expiresInSeconds = expiresInSeconds;
    }

    public String getAppealToken() {
        return appealToken;
    }

    public long getExpiresInSeconds() {
        return expiresInSeconds;
    }
}

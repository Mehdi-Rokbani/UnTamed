package com.untamed.untamedbackend.config;

import java.security.Principal;

public record NotificationWebSocketPrincipal(String userId, String email) implements Principal {
    @Override
    public String getName() {
        return userId;
    }
}

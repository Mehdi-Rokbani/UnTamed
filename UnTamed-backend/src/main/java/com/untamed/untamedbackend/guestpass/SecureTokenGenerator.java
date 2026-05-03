// src/main/java/com/untamed/untamedbackend/guestpass/SecureTokenGenerator.java
package com.untamed.untamedbackend.guestpass;

import java.security.SecureRandom;
import java.util.Base64;

public class SecureTokenGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public static String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }
}
// src/main/java/com/untamed/untamedbackend/security/PasswordPolicy.java
package com.untamed.untamedbackend.security;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class PasswordPolicy {
    private static final Pattern LOWER = Pattern.compile(".*[a-z].*");
    private static final Pattern UPPER = Pattern.compile(".*[A-Z].*");
    private static final Pattern DIGIT = Pattern.compile(".*\\d.*");
    private static final Pattern SYMBOL = Pattern.compile(".*[^A-Za-z0-9].*");

    private PasswordPolicy() {}

    public static void validateOrThrow(String password, String username, String email) {
        List<String> errors = validate(password, username, email);
        if (!errors.isEmpty()) {
            // return one compact message (simple UX)
            throw new IllegalArgumentException(String.join(" ", errors));
        }
    }

    public static List<String> validate(String password, String username, String email) {
        List<String> errors = new ArrayList<>();

        if (password == null) {
            errors.add("Password is required.");
            return errors;
        }

        if (password.length() < 8) errors.add("Password must be at least 8 characters.");
        if (password.contains(" ")) errors.add("Password must not contain spaces.");
        if (!LOWER.matcher(password).matches()) errors.add("Add at least one lowercase letter.");
        if (!UPPER.matcher(password).matches()) errors.add("Add at least one uppercase letter.");
        if (!DIGIT.matcher(password).matches()) errors.add("Add at least one number.");
        if (!SYMBOL.matcher(password).matches()) errors.add("Add at least one symbol.");

        // Optional hardening: avoid username/email parts inside password
        String p = password.toLowerCase(Locale.ROOT);
        if (username != null) {
            String u = username.trim().toLowerCase(Locale.ROOT);
            if (!u.isBlank() && u.length() >= 3 && p.contains(u)) {
                errors.add("Password must not contain your username.");
            }
        }
        if (email != null) {
            String e = email.trim().toLowerCase(Locale.ROOT);
            int at = e.indexOf('@');
            String local = at > 0 ? e.substring(0, at) : e;
            if (!local.isBlank() && local.length() >= 3 && p.contains(local)) {
                errors.add("Password must not contain your email.");
            }
        }

        return errors;
    }
}

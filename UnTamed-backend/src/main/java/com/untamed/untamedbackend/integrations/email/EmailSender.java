package com.untamed.untamedbackend.integrations.email;

public interface EmailSender {
    void send(String toEmail, String subject, String body);
}

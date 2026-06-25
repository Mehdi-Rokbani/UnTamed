package com.untamed.untamedbackend.payment.stripe;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.guestpass.GuestPassService;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class StripeWebhookControllerTest {

    private static final String SECRET = "whsec_test";

    @Test
    void validSignedUnsupportedEventReturnsOk() throws Exception {
        StripeWebhookController controller = controller();
        String payload = """
                {"id":"evt_test","object":"event","type":"charge.succeeded","data":{"object":{"id":"ch_test","object":"charge"}}}
                """;

        var response = controller.webhook(payload, signatureHeader(payload));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("received");
    }

    @Test
    void invalidSignatureReturnsBadRequest() {
        StripeWebhookController controller = controller();

        var response = controller.webhook("{}", "t=123,v1=bad");

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).isEqualTo("Invalid signature");
    }

    private StripeWebhookController controller() {
        StripeProperties properties = new StripeProperties();
        properties.setWebhookSecret(SECRET);

        return new StripeWebhookController(
                properties,
                mock(PaymentAttemptRepository.class),
                mock(BookingService.class),
                mock(GuestPassService.class)
        );
    }

    private String signatureHeader(String payload) throws Exception {
        long timestamp = System.currentTimeMillis() / 1000;
        String signedPayload = timestamp + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
        return "t=" + timestamp + ",v1=" + hex(digest);
    }

    private String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}

package com.untamed.untamedbackend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "app.mongo.ensure-indexes.enabled=false",
        "app.jobs.booking-expiration.enabled=false",
        "app.tags.seed.enabled=false"
})
class UnTamedBackendApplicationTests {

    @Test
    void contextLoads() {
    }

}

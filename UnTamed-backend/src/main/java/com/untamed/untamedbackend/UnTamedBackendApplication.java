// src/main/java/com/untamed/untamedbackend/UntamedBackendApplication.java
package com.untamed.untamedbackend;

import com.untamed.untamedbackend.config.LocationIqProperties;
import com.untamed.untamedbackend.config.RecommendationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
@EnableConfigurationProperties({LocationIqProperties.class,RecommendationProperties.class})

public class UnTamedBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(UnTamedBackendApplication.class, args);
    }
}

// src/main/java/com/untamed/untamedbackend/UntamedBackendApplication.java
package com.untamed.untamedbackend;

import com.untamed.untamedbackend.config.LocationIqProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(LocationIqProperties.class)
public class UnTamedBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(UnTamedBackendApplication.class, args);
    }
}

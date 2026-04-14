package com.untamed.untamedbackend.assistant;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.ai.openrouter")
public class AssistantProperties {

    private String apiKey;
    private String model = "openrouter/auto";
    private String baseUrl = "https://openrouter.ai/api/v1";
    private int timeoutMs = 20000;
}
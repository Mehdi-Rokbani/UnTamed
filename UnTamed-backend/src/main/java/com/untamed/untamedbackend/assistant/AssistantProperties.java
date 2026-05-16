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
    private String chatModel = "meta-llama/llama-3.1-8b-instruct:free";
    private String chatFallbackModel = "openrouter/free";
    private double chatTemperature = 0.3;
    private int chatMaxTokens = 400;
}

// src/main/java/com/untamed/untamedbackend/config/LocationIqProperties.java
package com.untamed.untamedbackend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "locationiq")
public class LocationIqProperties {
    private String baseUrl = "https://us1.locationiq.com";
    private String apiKey;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}

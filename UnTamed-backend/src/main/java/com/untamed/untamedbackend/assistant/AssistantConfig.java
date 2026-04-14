package com.untamed.untamedbackend.assistant;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AssistantProperties.class)
public class AssistantConfig {
}
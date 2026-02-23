// src/main/java/com/untamed/untamedbackend/integrations/locationiq/LocationIqReverseResponse.java
package com.untamed.untamedbackend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LocationIqReverseResponse {

    @JsonProperty("place_id")
    public String placeId;

    @JsonProperty("display_name")
    public String displayName;

    public String lat;
    public String lon;

    // LocationIQ returns "address": { ... }
    public Map<String, Object> address;
}

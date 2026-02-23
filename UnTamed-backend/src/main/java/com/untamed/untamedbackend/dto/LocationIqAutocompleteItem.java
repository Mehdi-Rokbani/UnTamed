// src/main/java/com/untamed/untamedbackend/integrations/locationiq/LocationIqAutocompleteItem.java
package com.untamed.untamedbackend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LocationIqAutocompleteItem {

    @JsonProperty("place_id")
    public String placeId;

    @JsonProperty("display_name")
    public String displayName;

    public String lat;
    public String lon;

    // often present in LocationIQ autocomplete:
    public String type;

    // Optional: helps with Tunisia filtering if present in response
    public Map<String, Object> address; // sometimes nested; we keep minimal here
}

package com.untamed.untamedbackend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LocationIqSearchItem {

    @JsonProperty("place_id")
    private String placeId;

    @JsonProperty("display_name")
    private String displayName;

    private String lat;
    private String lon;

    public String getPlaceId() {
        return placeId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getLat() {
        return lat;
    }

    public String getLon() {
        return lon;
    }
}

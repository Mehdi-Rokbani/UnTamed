// src/main/java/com/untamed/untamedbackend/integrations/locationiq/LocationIqClient.java
package com.untamed.untamedbackend.integrations.locationiq;

import com.untamed.untamedbackend.config.LocationIqProperties;
import com.untamed.untamedbackend.dto.LocationIqAutocompleteItem;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class LocationIqClient {

    private final WebClient webClient;
    private final WebClient staticMapClient;
    private final LocationIqProperties props;

    public LocationIqClient(LocationIqProperties props) {
        this.props = props;
        this.webClient = WebClient.builder()
                .baseUrl(props.getBaseUrl())
                .build();
        this.staticMapClient = WebClient.builder()
                .baseUrl(props.getStaticMapBaseUrl())
                .build();
    }

    public Mono<List<LocationIqAutocompleteItem>> autocomplete(String q, int limit, String countrycodes) {
        String encodedQ = URLEncoder.encode(q, StandardCharsets.UTF_8);
        String url = "/v1/autocomplete.php"
                + "?key=" + props.getApiKey()
                + "&q=" + encodedQ
                + "&limit=" + limit
                + "&format=json";

        if (countrycodes != null && !countrycodes.isBlank()) {
            url += "&countrycodes=" + URLEncoder.encode(countrycodes, StandardCharsets.UTF_8);
        }

        return webClient.get()
                .uri(url)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToFlux(LocationIqAutocompleteItem.class)
                .collectList();
    }

    public Mono<com.untamed.untamedbackend.dto.LocationIqReverseResponse> reverse(double lat, double lon, int zoom) {
        String url = "/v1/reverse.php"
                + "?key=" + props.getApiKey()
                + "&lat=" + lat
                + "&lon=" + lon
                + "&zoom=" + zoom
                + "&format=json";

        return webClient.get()
                .uri(url)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(com.untamed.untamedbackend.dto.LocationIqReverseResponse.class);
    }

    public Mono<byte[]> staticMap(double lat, double lon) {
        String url = "/v3/staticmap"
                + "?key=" + props.getApiKey()
                + "&center=" + lat + "," + lon
                + "&zoom=14"
                + "&size=640x280"
                + "&format=png"
                + "&maptype=streets";

        return staticMapClient.get()
                .uri(url)
                .accept(MediaType.IMAGE_PNG)
                .retrieve()
                .bodyToMono(byte[].class);
    }
}

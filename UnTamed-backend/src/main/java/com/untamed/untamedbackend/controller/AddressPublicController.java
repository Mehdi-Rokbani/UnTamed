package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.AddressSuggestionDto;
import com.untamed.untamedbackend.service.AddressPublicService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/addresses/public")
public class AddressPublicController {

    private final AddressPublicService addressPublicService;

    public AddressPublicController(AddressPublicService addressPublicService) {
        this.addressPublicService = addressPublicService;
    }

    @GetMapping("/suggest")
    public List<AddressSuggestionDto> suggest(
            @RequestParam(required = false) String q
    ) {
        return addressPublicService.suggest(q);
    }
}
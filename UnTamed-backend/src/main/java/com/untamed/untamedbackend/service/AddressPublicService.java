package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.AddressSuggestionDto;
import com.untamed.untamedbackend.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AddressPublicService {

    private final AddressRepository addressRepo;

    public List<AddressSuggestionDto> suggest(String q) {
        if (q == null || q.isBlank()) {
            return addressRepo.findTop20ByOrderByUsesCountDesc().stream()
                    .map(a -> new AddressSuggestionDto(a.getId(), a.getDisplayName()))
                    .toList();
        }

        return addressRepo.findTop10ByDisplayNameContainingIgnoreCaseOrderByUsesCountDesc(q).stream()
                .map(a -> new AddressSuggestionDto(a.getId(), a.getDisplayName()))
                .toList();
    }
}
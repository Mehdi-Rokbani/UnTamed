package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.repository.AddressRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/addresses")
public class AddressController {

    private final AddressRepository addressRepo;

    public AddressController(AddressRepository addressRepo) {
        this.addressRepo = addressRepo;
    }

    @GetMapping("/{id}")
    public Address getById(@PathVariable String id) {
        return addressRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Address not found"));
    }

    @GetMapping("/popular")
    public List<Address> popular() {
        return addressRepo.findTop20ByOrderByUsesCountDesc();
    }
}

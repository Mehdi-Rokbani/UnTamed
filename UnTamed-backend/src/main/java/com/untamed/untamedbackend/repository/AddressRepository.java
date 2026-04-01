// src/main/java/com/untamed/untamedbackend/repository/AddressRepository.java
package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Address;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.List;

public interface AddressRepository extends MongoRepository<Address, String> {

    // Dedupe key (best way)
    Optional<Address> findByProviderAndProviderPlaceId(String provider, String providerPlaceId);

    // Optional helpers (useful later)
    Optional<Address> findByNormalizedKey(String normalizedKey);

    List<Address> findTop20ByOrderByUsesCountDesc();

    List<Address> findTop10ByDisplayNameContainingIgnoreCaseOrderByUsesCountDesc(String q);
    List<Address> findByGovernorateIgnoreCase(String governorate);
    List<Address> findByGovernorateIgnoreCaseOrderByUsesCountDesc(String governorate);


    List<Address> findAllByProviderAndProviderPlaceId(String provider, String providerPlaceId);

}

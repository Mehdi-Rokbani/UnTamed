// src/main/java/com/untamed/untamedbackend/repository/CategoryRepository.java
package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends MongoRepository<Category, String> {

    Optional<Category> findBySlug(String slug);

    List<Category> findByActiveTrueOrderBySortOrderAscNameAsc();
}

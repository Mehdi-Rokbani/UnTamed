// src/main/java/com/untamed/untamedbackend/repository/TagRepository.java
package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Tag;
import com.untamed.untamedbackend.model.TagType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends MongoRepository<Tag, String> {

    Optional<Tag> findBySlug(String slug);

    List<Tag> findByActiveTrueOrderBySortOrderAscNameAsc();

    List<Tag> findByTypeAndActiveTrueOrderBySortOrderAscNameAsc(TagType type);

    boolean existsBySlug(String slug);
}
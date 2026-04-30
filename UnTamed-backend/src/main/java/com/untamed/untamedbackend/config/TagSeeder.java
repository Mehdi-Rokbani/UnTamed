package com.untamed.untamedbackend.config;

import com.untamed.untamedbackend.model.Tag;
import com.untamed.untamedbackend.model.TagStatus;
import com.untamed.untamedbackend.model.TagType;
import com.untamed.untamedbackend.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class TagSeeder implements CommandLineRunner {

    private final TagRepository tagRepository;

    @Override
    public void run(String... args) {
        if (tagRepository.count() > 0) {
            System.out.println("Tags already exist: " + tagRepository.count());
            return;
        }

        System.out.println("Seeding base tags...");

        tagRepository.saveAll(List.of(

                // ACTIVITY
                Tag.builder().slug("hiking").name("Hiking").type(TagType.ACTIVITY).status(TagStatus.APPROVED).active(true).sortOrder(1).build(),
                Tag.builder().slug("camping").name("Camping").type(TagType.ACTIVITY).status(TagStatus.APPROVED).active(true).sortOrder(2).build(),
                Tag.builder().slug("diving").name("Diving").type(TagType.ACTIVITY).status(TagStatus.APPROVED).active(true).sortOrder(3).build(),
                Tag.builder().slug("quad-biking").name("Quad Biking").type(TagType.ACTIVITY).status(TagStatus.APPROVED).active(true).sortOrder(4).build(),

                // ENVIRONMENT
                Tag.builder().slug("forest").name("Forest").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(10).build(),
                Tag.builder().slug("mountain").name("Mountain").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(11).build(),
                Tag.builder().slug("beach").name("Beach").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(12).build(),
                Tag.builder().slug("desert").name("Desert").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(13).build(),
                Tag.builder().slug("waterfall").name("Waterfall").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(14).build(),
                Tag.builder().slug("sea").name("Sea").type(TagType.ENVIRONMENT).status(TagStatus.APPROVED).active(true).sortOrder(15).build(),

                // VIBE
                Tag.builder().slug("relaxing").name("Relaxing").type(TagType.VIBE).status(TagStatus.APPROVED).active(true).sortOrder(20).build(),
                Tag.builder().slug("adventure").name("Adventure").type(TagType.VIBE).status(TagStatus.APPROVED).active(true).sortOrder(21).build(),
                Tag.builder().slug("adrenaline").name("Adrenaline").type(TagType.VIBE).status(TagStatus.APPROVED).active(true).sortOrder(22).build(),
                Tag.builder().slug("family-friendly").name("Family Friendly").type(TagType.VIBE).status(TagStatus.APPROVED).active(true).sortOrder(23).build(),

                // EFFORT
                Tag.builder().slug("beginner-friendly").name("Beginner Friendly").type(TagType.EFFORT).status(TagStatus.APPROVED).active(true).sortOrder(30).build(),
                Tag.builder().slug("physically-demanding").name("Physically Demanding").type(TagType.EFFORT).status(TagStatus.APPROVED).active(true).sortOrder(31).build(),
                Tag.builder().slug("short-trip").name("Short Trip").type(TagType.EFFORT).status(TagStatus.APPROVED).active(true).sortOrder(32).build(),
                Tag.builder().slug("long-distance").name("Long Distance").type(TagType.EFFORT).status(TagStatus.APPROVED).active(true).sortOrder(33).build(),

                // BUDGET
                Tag.builder().slug("budget-friendly").name("Budget Friendly").type(TagType.BUDGET).status(TagStatus.APPROVED).active(true).sortOrder(40).build(),
                Tag.builder().slug("premium").name("Premium").type(TagType.BUDGET).status(TagStatus.APPROVED).active(true).sortOrder(41).build()

        ));

        System.out.println("Base tags seeded successfully.");
    }
}
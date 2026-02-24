    package com.untamed.untamedbackend.controller;

    import com.untamed.untamedbackend.dto.PublicTemplateCardResponse;
    import com.untamed.untamedbackend.service.ActivityTemplatePublicService;
    import org.springframework.web.bind.annotation.*;
    import com.untamed.untamedbackend.dto.PublicSessionDto;

    import java.util.List;

    @RestController
    @RequestMapping("/api/templates/public")
    public class ActivityTemplatePublicController {

        private final ActivityTemplatePublicService publicService;

        public ActivityTemplatePublicController(ActivityTemplatePublicService publicService) {
            this.publicService = publicService;
        }

        @GetMapping
        public List<PublicTemplateCardResponse> list() {
            return publicService.list();
        }

        @GetMapping("/{id}")
        public PublicTemplateCardResponse get(@PathVariable String id) {
            return publicService.get(id);
        }
        @GetMapping("/{id}/sessions")
        public List<PublicSessionDto> listSessions(@PathVariable String id) {
            return publicService.listUpcomingSessions(id);
        }
    }
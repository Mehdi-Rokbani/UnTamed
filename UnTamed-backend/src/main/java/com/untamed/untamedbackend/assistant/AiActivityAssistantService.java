package com.untamed.untamedbackend.assistant;

public interface AiActivityAssistantService {

    GenerateActivityDraftResponse generateDraft(GenerateActivityDraftRequest request, String authEmail);
}
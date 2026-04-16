package com.untamed.untamedbackend.smartsearch.service;

import com.untamed.untamedbackend.smartsearch.dto.AiSearchPlan;

public interface AiQueryUnderstandingService {
    AiSearchPlan buildPlan(String rawQuery);
}
package com.untamed.untamedbackend.smartsearch.service;

import java.util.List;

public interface QueryEmbeddingService {

    List<Double> embedQuery(String query);
}
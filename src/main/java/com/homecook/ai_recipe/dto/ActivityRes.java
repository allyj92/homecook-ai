package com.homecook.ai_recipe.dto;

import java.util.Map;

public record ActivityRes(Long id, String type, long ts, Map<String, Object> data) {}
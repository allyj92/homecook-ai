package com.homecook.ai_recipe.dto;

import java.util.Map;

public record ActivityCreateReq(String type, Map<String, Object> data) {}
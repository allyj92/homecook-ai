package com.homecook.ai_recipe.dto;

public record SessionUser(
        String provider,
        String providerId,
        String email,
        String name,
        String avatar
) {}
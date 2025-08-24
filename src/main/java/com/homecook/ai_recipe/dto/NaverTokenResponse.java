package com.homecook.ai_recipe.dto;

public record NaverTokenResponse(
        String access_token,
        String refresh_token,
        String token_type,
        String expires_in,
        String error,
        String error_description
) {}

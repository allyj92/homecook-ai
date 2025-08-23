package com.homecook.ai_recipe.dto;

public record GoogleTokenResponse(
        String access_token,
        String expires_in,
        String refresh_token,
        String scope,
        String token_type,
        String id_token
) {}


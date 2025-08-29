package com.homecook.ai_recipe.auth;

import java.io.Serializable;

/**
 * 세션에 저장될 최소 사용자 정보 DTO
 */
public record SessionUser(
        String provider,      // "local", "google", "kakao" ...
        String providerId,    // 각 provider에서의 user 식별자
        String email,
        String name,
        String avatar
) implements Serializable {}

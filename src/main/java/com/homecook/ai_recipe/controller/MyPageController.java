// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
@Slf4j
public class MyPageController {
    private final FavoriteService favoriteService;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /** 세션에서 로그인 사용자 PK 뽑기 (401은 401로 돌려보냄 — 500로 숨지지 않게) */
    private ResponseEntity<?> extractUserIdOr401(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) {
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        }
        try {
            Long uid = Long.valueOf(su.providerId());
            return ResponseEntity.ok(uid);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(401).body(Map.of("message","local account required"));
        }
    }

    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(HttpSession session) {
        var r = extractUserIdOr401(session);
        if (r.getStatusCode().is4xxClientError()) return r; // 401 그대로 반환
        Long userId = (Long) r.getBody();

        try {
            var list = favoriteService.list(userId).stream()
                    .map(f -> new FavoriteDto(
                            f.getId(),
                            f.getRecipeId(),
                            f.getCreatedAt() == null ? null : f.getCreatedAt().format(ISO)
                    ))
                    .toList();
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            log.error("[/api/me/favorites] failed, userId={}", userId, e);
            // 🔴 원인 노출: 프론트 콘솔/Network 탭에서 바로 볼 수 있음
            return ResponseEntity.status(500).body(Map.of(
                    "message", "internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message"),
                    "cause", Optional.ofNullable(e.getCause()).map(Throwable::toString).orElse(null)
            ));
        }
    }

    @PostMapping("/favorites/{recipeId}")
    public ResponseEntity<?> addFavorite(@PathVariable Long recipeId, HttpSession session) {
        var r = extractUserIdOr401(session);
        if (r.getStatusCode().is4xxClientError()) return r;
        Long userId = (Long) r.getBody();

        try {
            var f = favoriteService.add(userId, recipeId);
            return ResponseEntity.ok(new FavoriteDto(
                    f.getId(), f.getRecipeId(),
                    f.getCreatedAt() == null ? null : f.getCreatedAt().format(ISO)
            ));
        } catch (Exception e) {
            log.error("[POST /api/me/favorites/{}] failed, userId={}", recipeId, userId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "message", "internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message")
            ));
        }
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        var r = extractUserIdOr401(session);
        if (r.getStatusCode().is4xxClientError()) return r;
        Long userId = (Long) r.getBody();

        try {
            favoriteService.remove(userId, recipeId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("[DELETE /api/me/favorites/{}] failed, userId={}", recipeId, userId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "message", "internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message")
            ));
        }
    }
}

// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
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

    // 🔽 추가: 유저 조회에 필요
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /** 세션 → 실제 UserAccount(PK) 찾기: 로컬PK → 소셜 링크 → 이메일 폴백 */
    private ResponseEntity<?> resolveUserId(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) {
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        }

        try {
            // 1) 로컬/연동-로컬: providerId가 곧 UserAccount PK
            if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
                Long uid = Long.valueOf(su.providerId());
                return ResponseEntity.ok(uid);
            }

            // 2) 소셜 링크 테이블에서 찾기
            Optional<UserAccount> linked = oauthService.findByProvider(su.provider(), su.providerId());
            if (linked.isPresent()) return ResponseEntity.ok(linked.get().getId());

            // 3) 이메일로 폴백
            if (su.email() != null && !su.email().isBlank()) {
                var byEmail = userRepo.findByEmailIgnoreCase(su.email());
                if (byEmail.isPresent()) return ResponseEntity.ok(byEmail.get().getId());
            }

            // 못 찾으면 401
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        } catch (NumberFormatException e) {
            // providerId가 숫자가 아니었음(소셜). 위의 2,3 경로로 이미 처리했으므로 여기 오면 폴백 실패
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        }
    }

    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(HttpSession session) {
        var r = resolveUserId(session);
        if (!r.getStatusCode().is2xxSuccessful()) return r;
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
            log.error("[GET /api/me/favorites] failed, userId={}", userId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "message","internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message")
            ));
        }
    }

    @PostMapping("/favorites/{recipeId}")
    public ResponseEntity<?> addFavorite(@PathVariable Long recipeId, HttpSession session) {
        var r = resolveUserId(session);
        if (!r.getStatusCode().is2xxSuccessful()) return r;
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
                    "message","internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message")
            ));
        }
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        var r = resolveUserId(session);
        if (!r.getStatusCode().is2xxSuccessful()) return r;
        Long userId = (Long) r.getBody();

        try {
            favoriteService.remove(userId, recipeId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("[DELETE /api/me/favorites/{}] failed, userId={}", recipeId, userId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "message","internal_error",
                    "exception", e.getClass().getName(),
                    "error", Optional.ofNullable(e.getMessage()).orElse("no-message")
            ));
        }
    }
}

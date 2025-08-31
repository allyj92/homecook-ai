// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.service.OAuthAccountService; // ← 소셜 계정 → UserAccount 매핑
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;
    private final OAuthAccountService oauthAccountService;

    private Long requireLogin(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 1) 로컬 계정: providerId가 DB PK(Long)라고 가정
        if ("local".equalsIgnoreCase(su.provider())) {
            try {
                return Long.valueOf(su.providerId());
            } catch (NumberFormatException e) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid local session");
            }
        }

        // 2) 소셜 계정: provider + providerId 로 UserAccount 찾기
        return oauthAccountService.findByProvider(su.provider(), su.providerId())
                .map(UserAccount::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "social account not linked"));
    }

    @GetMapping("/favorites")
    public List<FavoriteDto> favorites(HttpSession session) {
        Long userId = requireLogin(session);
        return favoriteService.list(userId).stream()
                .map(f -> new FavoriteDto(f.getId(), f.getRecipeId(), f.getCreatedAt()))
                .toList();
    }

    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        var f = favoriteService.add(userId, recipeId);
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getCreatedAt());
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<Void> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        favoriteService.remove(userId, recipeId);
        return ResponseEntity.ok().build();
    }
}

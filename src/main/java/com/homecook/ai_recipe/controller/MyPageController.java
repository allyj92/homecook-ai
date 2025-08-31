// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;

    private Long requireLogin(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        // local은 providerId가 숫자 PK, 소셜은 별도 flow로 연결하셨다면 그 PK 사용
        try { return Long.valueOf(su.providerId()); }
        catch (NumberFormatException e) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "local account required");
        }
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
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        favoriteService.remove(userId, recipeId);
        return ResponseEntity.ok().build();
    }
}

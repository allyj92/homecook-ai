// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private Long requireLogin(HttpSession session) {
        var su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        try { return Long.valueOf(su.providerId()); }
        catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "local account required");
        }
    }

    @GetMapping("/favorites")
    public List<FavoriteDto> favorites(HttpSession session) {
        Long userId = requireLogin(session);
        return favoriteService.list(userId).stream()
                .map(f -> new FavoriteDto(
                        f.getId(),
                        f.getRecipeId(),
                        f.getTitle(),
                        f.getSummary(),
                        f.getImage(),
                        f.getMeta(),
                        f.getCreatedAt() == null ? null : ISO.format(f.getCreatedAt())
                ))
                .toList();
    }

    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        try {
            var f = favoriteService.add(userId, recipeId);
            return new FavoriteDto(
                    f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                    f.getImage(), f.getMeta(),
                    f.getCreatedAt() == null ? null : ISO.format(f.getCreatedAt())
            );
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            // 예상치 못한 에러는 409로 낮춰서 클라에서 멱등 처리
            throw new ResponseStatusException(HttpStatus.CONFLICT, "already saved?", e);
        }
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        favoriteService.remove(userId, recipeId);
        return ResponseEntity.ok().build();
    }
}

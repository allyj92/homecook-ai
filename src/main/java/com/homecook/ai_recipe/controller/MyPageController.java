// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
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
    private final UserAccountRepository userRepo;

    private Long requireLogin(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");

        // 1) providerId가 숫자(PK)라면
        try { return Long.valueOf(su.providerId()); } catch (NumberFormatException ignore) {}

        // 2) 이메일 폴백(소셜)
        if (su.email() != null && !su.email().isBlank()) {
            return userRepo.findByEmailIgnoreCase(su.email())
                    .map(UserAccount::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not linked"));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
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
        if (recipeId == null || recipeId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid recipeId");
        Long userId = requireLogin(session);
        var f = favoriteService.add(userId, recipeId);
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getCreatedAt());
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        if (recipeId == null || recipeId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid recipeId");
        Long userId = requireLogin(session);
        favoriteService.remove(userId, recipeId);
        return ResponseEntity.ok().build();
    }
}

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

// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;
    private final UserAccountRepository userRepo;

    private Long requireLogin(HttpSession session) {
        var su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        try { return Long.valueOf(su.providerId()); } catch (NumberFormatException ignore) {}
        return userRepo.findByEmailIgnoreCase(su.email())
                .map(UserAccount::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not linked"));
    }

    @GetMapping("/favorites")
    public List<FavoriteDto> favorites(HttpSession session) {
        Long userId = requireLogin(session);
        return favoriteService.list(userId).stream()
                .map(f -> new FavoriteDto(
                        f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(), f.getImage(), f.getMeta(), f.getCreatedAt()
                ))
                .toList();
    }

    // 바디는 선택(optional) — 없으면 null로 저장
    public record FavBody(String title, String summary, String image, String meta) {}

    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavorite(@PathVariable Long recipeId,
                                   @RequestBody(required = false) FavBody body,
                                   HttpSession session) {
        Long userId = requireLogin(session);
        var f = favoriteService.add(
                userId, recipeId,
                body == null ? null : body.title(),
                body == null ? null : body.summary(),
                body == null ? null : body.image(),
                body == null ? null : body.meta()
        );
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(), f.getImage(), f.getMeta(), f.getCreatedAt());
    }

    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        Long userId = requireLogin(session);
        favoriteService.remove(userId, recipeId);
        return ResponseEntity.ok().build();
    }
}


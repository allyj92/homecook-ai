package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;

    private Long requireLogin(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        try {
            // 현재 세션 설계가 providerId(문자열)에 로컬 PK가 들어있다고 하셨음
            return Long.valueOf(su.providerId());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "local account required");
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

    // ====== 에러를 명확한 HTTP 코드로 변환 ======
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                java.util.Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> handleConflict(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                java.util.Map.of("message", "duplicate favorite"));
    }
}

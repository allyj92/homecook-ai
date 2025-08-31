// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteCreateRequest;
import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {
    private final FavoriteService favoriteService;
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /* ───────────────── 로그인 확인 (WishlistController의 requireUser 동등) ───────────────── */
    private Long requireLogin(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new RuntimeException("401");

        // local(or local-or-linked) → providerId가 UserAccount PK
        if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
            try { return Long.valueOf(su.providerId()); } catch (NumberFormatException ignore) {}
        }

        // 소셜 계정이 UserAccount에 링크되어 있으면 그 PK
        var linked = oauthService.findByProvider(su.provider(), su.providerId());
        if (linked.isPresent()) return linked.get().getId();

        // 이메일 fallback
        if (su.email() != null && !su.email().isBlank()) {
            var byEmail = userRepo.findByEmailIgnoreCase(su.email());
            if (byEmail.isPresent()) return byEmail.get().getId();
        }

        throw new RuntimeException("401");
    }


    /** 세션에서 UserAccount 찾아오기 (로컬/소셜 모두 지원) */
    private UserAccount requireUser(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
            try {
                Long uid = Long.valueOf(su.providerId());
                return userRepo.findById(uid)
                        .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
            } catch (NumberFormatException ignore) {}
        }

        var linked = oauthService.findByProvider(su.provider(), su.providerId());
        if (linked.isPresent()) return linked.get();

        if (su.email() != null && !su.email().isBlank()) {
            return userRepo.findByEmailIgnoreCase(su.email())
                    .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
        }

        throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
    }

    /** 즐겨찾기 목록 */
    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(HttpSession session) {
        var me = requireUser(session);
        var rows = favoriteService.list(me.getId());

        List<FavoriteDto> dto = rows.stream()
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

        return ResponseEntity.ok(dto);
    }

    /** 찜 추가 */
    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavorite(@PathVariable Long recipeId,
                                   @RequestBody(required = false) FavoriteCreateRequest req,
                                   HttpSession session) {
        Long userId = requireLogin(session);

        String title   = norm(req == null ? null : req.getTitle());
        String summary = norm(req == null ? null : req.getSummary());
        String image   = norm(req == null ? null : req.getImage());
        String meta    = norm(req == null ? null : req.getMeta());

        var f = favoriteService.add(userId, recipeId, title, summary, image, meta);
        return new FavoriteDto(
                f.getId(), f.getRecipeId(),
                f.getTitle(), f.getSummary(), f.getImage(), f.getMeta(),
                f.getCreatedAt() == null ? null : ISO.format(f.getCreatedAt())
        );
    }

    private static String norm(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** 찜 삭제 */
    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        var me = requireUser(session);
        favoriteService.remove(me.getId(), recipeId);
        return ResponseEntity.ok(Map.of("removed", true));
    }
}

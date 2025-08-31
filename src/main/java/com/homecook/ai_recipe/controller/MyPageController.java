// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
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
    private final FavoriteRepository favoriteRepository;

    // 소셜/이메일 매핑용
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private ResponseEntity<?> resolveUserId(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        try {
            if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
                return ResponseEntity.ok(Long.valueOf(su.providerId()));
            }
            Optional<UserAccount> linked = oauthService.findByProvider(su.provider(), su.providerId());
            if (linked.isPresent()) return ResponseEntity.ok(linked.get().getId());
            if (su.email()!=null && !su.email().isBlank()) {
                var byEmail = userRepo.findByEmailIgnoreCase(su.email());
                if (byEmail.isPresent()) return ResponseEntity.ok(byEmail.get().getId());
            }
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        } catch (NumberFormatException e) {
            return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
        }
    }

    /** 🔹 미리보기: ?limit=3 같이 호출 → wishlist_item 조인으로 메타 포함 */
    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(@RequestParam(required = false) Integer limit,
                                       HttpSession session) {
        var r = resolveUserId(session);
        if (!r.getStatusCode().is2xxSuccessful()) return r;
        Long userId = (Long) r.getBody();

        try {
            if (limit != null && limit > 0) {
                var rows = favoriteRepository.findTopWithMeta(userId, limit);
                var dto = rows.stream().map(w ->
                        new FavoriteDto(
                                w.getId(),
                                w.getRecipeId(),
                                w.getTitle(),
                                w.getSummary(),
                                w.getImage(),
                                w.getMeta(),
                                w.getCreatedAt()==null? null : w.getCreatedAt().format(ISO)
                        )
                ).toList();
                return ResponseEntity.ok(dto);
            }

            // limit 없이 호출되면(구형 클라이언트 대비) 최소 필드라도 리턴
            var list = favoriteService.list(userId).stream().map(f ->
                    new FavoriteDto(
                            f.getId(), f.getRecipeId(),
                            null, null, null, null,
                            f.getCreatedAt()==null? null : f.getCreatedAt().format(ISO)
                    )
            ).toList();
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            log.error("GET /api/me/favorites failed, userId={}", userId, e);
            return ResponseEntity.status(500).body(Map.of("message","internal_error"));
        }
    }

    /** 🔹 전체 페이지: /api/me/favorites/page?page=0&size=12 */
    @GetMapping("/favorites/page")
    public ResponseEntity<?> favoritesPage(@RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "12") int size,
                                           HttpSession session) {
        var r = resolveUserId(session);
        if (!r.getStatusCode().is2xxSuccessful()) return r;
        Long userId = (Long) r.getBody();

        try {
            Pageable pageable = PageRequest.of(Math.max(page,0), Math.min(Math.max(size,1), 50));
            var pg = favoriteRepository.findPageWithMeta(userId, pageable);
            var dto = pg.getContent().stream().map(w ->
                    new FavoriteDto(
                            w.getId(),
                            w.getRecipeId(),
                            w.getTitle(),
                            w.getSummary(),
                            w.getImage(),
                            w.getMeta(),
                            w.getCreatedAt()==null? null : w.getCreatedAt().format(ISO)
                    )
            ).toList();
            Map<String,Object> resp = new HashMap<>();
            resp.put("content", dto);
            resp.put("page", pg.getNumber());
            resp.put("size", pg.getSize());
            resp.put("totalElements", pg.getTotalElements());
            resp.put("totalPages", pg.getTotalPages());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("GET /api/me/favorites/page failed, userId={}", userId, e);
            return ResponseEntity.status(500).body(Map.of("message","internal_error"));
        }
    }
}

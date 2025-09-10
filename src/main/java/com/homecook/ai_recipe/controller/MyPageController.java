// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyPageController {

    private static final Logger log = LoggerFactory.getLogger(MyPageController.class);

    private final FavoriteService favoriteService;
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /* ========== 내부 유틸 ========== */

    /** 로그인 강제: (1) OAuth2User(email) 우선 → (2) 옛 세션 로그인 순서로 확인 */
    private UserAccount requireUser(HttpSession session, OAuth2User ou) {
        // 1) 새 방식: OAuth2User 먼저
        if (ou != null) {
            String email = (String) ou.getAttributes().get("email");
            String name  = (String) ou.getAttributes().getOrDefault("name", "User");
            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
            }
            return userRepo.findByEmailIgnoreCase(email).orElseGet(() -> {
                UserAccount ua = new UserAccount();
                ua.setEmail(email);
                ua.setName(name);
                return userRepo.save(ua);
            });
        }

        // 2) 옛 방식: 세션 LOGIN_USER
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su != null) {
            // 로컬(또는 링크된 로컬): providerId = UserAccount PK
            if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
                try {
                    Long uid = Long.valueOf(su.providerId());
                    return userRepo.findById(uid)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
                } catch (NumberFormatException ignore) { /* fallthrough */ }
            }
            // 소셜 링크된 계정 찾기
            var linked = oauthService.findByProvider(su.provider(), su.providerId());
            if (linked.isPresent()) return linked.get();

            // 이메일로 조회
            if (su.email() != null && !su.email().isBlank()) {
                return userRepo.findByEmailIgnoreCase(su.email())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
            }
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
    }

    private Long requireUserId(HttpSession session, OAuth2User ou) {
        return requireUser(session, ou).getId();
    }

    /* ========== API ========== */

    /** 즐겨찾기 목록 */
    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(HttpSession session,
                                       @AuthenticationPrincipal OAuth2User ou,
                                       @RequestParam(name = "page", required = false) Integer page,
                                       @RequestParam(name = "size", required = false) Integer size) {

        var me = requireUser(session, ou);
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

    /** 케이스 #1: 기존 프런트 규격 (경로에 recipeId) */
    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavoriteByPath(@PathVariable Long recipeId,
                                         @RequestBody(required = false) Map<String, Object> body,
                                         HttpSession session,
                                         @AuthenticationPrincipal OAuth2User ou) {

        Long uid = requireUserId(session, ou);

        String title   = body != null ? strOrNull(body.get("title"))   : null;
        String summary = body != null ? strOrNull(body.get("summary")) : null;
        String image   = body != null ? strOrNull(body.get("image"))   : null;
        String meta    = body != null ? strOrNull(body.get("meta"))    : null;

        var f = favoriteService.add(uid, recipeId, title, summary, image, meta);

        return new FavoriteDto(
                f.getId(), f.getRecipeId(),
                f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(),
                f.getCreatedAt() != null ? ISO.format(f.getCreatedAt()) : null
        );
    }

    /** 케이스 #2: 새 프런트 규격 (바디에 recipeId) */
    @PostMapping(path = "/favorites", consumes = MediaType.APPLICATION_JSON_VALUE)
    public FavoriteDto addFavoriteByBody(@RequestBody Map<String, Object> body,
                                         HttpSession session,
                                         @AuthenticationPrincipal OAuth2User ou) {

        if (body == null || body.get("recipeId") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId is required");
        }
        Long recipeId = longOrNull(body.get("recipeId"));
        if (recipeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId must be number");
        }

        Long uid = requireUserId(session, ou);

        String title   = strOrNull(body.get("title"));
        String summary = strOrNull(body.get("summary"));
        String image   = strOrNull(body.get("image"));
        String meta    = strOrNull(body.get("meta"));

        var f = favoriteService.add(uid, recipeId, title, summary, image, meta);

        return new FavoriteDto(
                f.getId(), f.getRecipeId(),
                f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(),
                f.getCreatedAt() != null ? ISO.format(f.getCreatedAt()) : null
        );
    }

    /** 찜 삭제 */
    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId,
                                            HttpSession session,
                                            @AuthenticationPrincipal OAuth2User ou) {
        var me = requireUser(session, ou);
        favoriteService.remove(me.getId(), recipeId);
        return ResponseEntity.ok(Map.of("removed", true));
    }

    /* ========== helpers ========== */

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
    private static String strOrNull(Object o) {
        return o == null ? null : trimOrNull(String.valueOf(o));
    }
    private static Long longOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(o)); } catch (Exception e) { return null; }
    }
}

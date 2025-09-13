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
import java.util.Optional;

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

    private UserAccount requireUser(HttpSession session, OAuth2User ou) {
        // 0) attributes에 uid가 이미 실려 있다면 최우선 사용
        if (ou != null) {
            Object uidAttr = ou.getAttributes().get("uid");
            if (uidAttr != null) {
                Long uid = toLong(uidAttr);
                if (uid != null) {
                    return userRepo.findById(uid)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
                }
            }
        }

        // 1) OAuth2User 기반 식별
        if (ou != null) {
            String provider = strOrNull(ou.getAttributes().get("provider")); // google/naver/kakao...
            String pid      = strOrNull(ou.getAttributes().get("id"));       // provider side user id

            // 1-a) provider + id 로 먼저 연결 계정 조회
            if (provider != null && pid != null) {
                Optional<UserAccount> linked = oauthService.findByProvider(provider, pid);
                if (linked.isPresent()) return linked.get();
            }

            // 1-b) 이메일로 조회(소셜에서 이메일 제공되는 경우)
            String email = strOrNull(ou.getAttributes().get("email"));
            String name  = strOrNull(ou.getAttributes().get("name"));
            if (email != null) {
                return userRepo.findByEmailIgnoreCase(email).orElseGet(() -> {
                    UserAccount ua = new UserAccount();
                    ua.setEmail(email);
                    ua.setName(name != null ? name : "User");
                    return userRepo.save(ua);
                });
            }

            // ★ findOrCreate 제거: 링크도 없고 이메일도 없으면 401로 거절
            if (provider != null && pid != null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated_no_email");
            }

            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 2) 구(舊) 세션 방식
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su != null) {
            if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
                Long uid = toLong(su.providerId());
                if (uid != null) {
                    return userRepo.findById(uid)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
                }
            }
            var linked = oauthService.findByProvider(su.provider(), su.providerId());
            if (linked.isPresent()) return linked.get();

            String email = su.email();
            if (email != null && !email.isBlank()) {
                return userRepo.findByEmailIgnoreCase(email)
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
    public ResponseEntity<List<FavoriteDto>> favorites(
            HttpSession session,
            @AuthenticationPrincipal OAuth2User ou) {

        log.debug("[FAV] /favorites enter; principal? {}", (ou != null));
        final var me = requireUser(session, ou);   // 여기서 401이면 이제 401로 내려가야 정답
        log.debug("[FAV] /favorites uid={}", me.getId());

        final var rows = favoriteService.list(me.getId()); // ★ 여기서 NPE/SQL 에러 가능
        log.debug("[FAV] /favorites rows={}", (rows == null ? -1 : rows.size()));

        final var dto = rows.stream()
                .map(f -> new FavoriteDto(
                        f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                        f.getImage(), f.getMeta(),
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
        Long recipeId = toLong(body.get("recipeId"));
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
    public ResponseEntity<Map<String, Object>> removeFavorite(@PathVariable Long recipeId,
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
    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(o)); } catch (Exception e) { return null; }
    }


}

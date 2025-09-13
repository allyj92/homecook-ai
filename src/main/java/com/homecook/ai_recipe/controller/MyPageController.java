// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
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

    /* ======== helpers ======== */
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
    /** createdAt을 안전하게 문자열화 */
    private static String toIso(Object t) {
        if (t == null) return null;
        try {
            if (t instanceof String s) return s;
            if (t instanceof OffsetDateTime odt) return odt.toString();
            if (t instanceof ZonedDateTime zdt) return zdt.toOffsetDateTime().toString();
            if (t instanceof Instant i) return i.toString(); // ISO_INSTANT (UTC)
            if (t instanceof LocalDateTime ldt) return ldt.toString(); // ISO_LOCAL_DATE_TIME
            if (t instanceof java.sql.Timestamp ts) return ts.toInstant().toString();
        } catch (Exception e) {
            log.warn("[FAV] createdAt toIso failed: {} ({})", t, t.getClass(), e);
        }
        return String.valueOf(t);
    }

    /** 토큰까지 받아 provider fallback을 보장하는 사용자 해석 */
    private UserAccount requireUser(
            HttpSession session,
            OAuth2User ou,
            OAuth2AuthenticationToken authToken
    ) {
        // 0) attributes에 uid 있으면 최우선
        if (ou != null) {
            Long uidAttr = toLong(ou.getAttributes().get("uid"));
            if (uidAttr != null) {
                return userRepo.findById(uidAttr)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
            }
        }

        // 1) provider: 토큰에서 가장 안정적으로 확보
        String provider = null;
        if (authToken != null) {
            provider = authToken.getAuthorizedClientRegistrationId(); // "google", "naver", ...
        } else if (ou != null) {
            provider = strOrNull(ou.getAttributes().get("provider"));
        }

        if (ou != null) {
            var a = ou.getAttributes();
            // pid: OIDC(구글)는 sub, OAuth2(네이버/카카오)는 id
            String pid = strOrNull(a.get("id"));
            if (pid == null) pid = strOrNull(a.get("sub"));

            // 1-a) provider+pid로 링크 조회
            if (provider != null && pid != null) {
                Optional<UserAccount> linked = oauthService.findByProvider(provider, pid);
                if (linked.isPresent()) return linked.get();
            }

            // 1-b) 이메일 경로 (없으면 생성) + 링크 생성
            String email = strOrNull(a.get("email"));
            String name  = strOrNull(a.get("name"));
            if (email != null) {
                UserAccount ua = userRepo.findByEmailIgnoreCase(email).orElseGet(() -> {
                    UserAccount x = new UserAccount();
                    x.setEmail(email);
                    x.setName(name != null ? name : "User");
                    return userRepo.save(x);
                });
                if (provider != null && pid != null) {
                    oauthService.createLinkIfAbsent(provider, pid, ua.getId());
                }
                return ua;
            }

            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 2) 구 세션 방식
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

    private Long requireUserId(HttpSession session, OAuth2User ou, OAuth2AuthenticationToken token) {
        return requireUser(session, ou, token).getId();
    }

    /* ======== API ======== */

    /** 즐겨찾기 목록 */
    @GetMapping("/favorites")
    public ResponseEntity<List<FavoriteDto>> favorites(
            HttpSession session,
            @AuthenticationPrincipal OAuth2User ou,
            OAuth2AuthenticationToken authToken
    ) {
        log.debug("[FAV] /favorites enter; principal? {}", (ou != null));
        try {
            var me = requireUser(session, ou, authToken);
            log.debug("[FAV] /favorites me.id={}", me.getId());

            var rows = favoriteService.list(me.getId());
            log.debug("[FAV] /favorites service returned {} rows", rows != null ? rows.size() : -1);

            var dto = rows.stream()
                    .map(f -> new FavoriteDto(
                            f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                            f.getImage(), f.getMeta(),
                            toIso(f.getCreatedAt())
                    ))
                    .toList();

            return ResponseEntity.ok(dto);
        } catch (ResponseStatusException rse) {
            log.warn("[FAV] /favorites 4xx {}", rse.getReason());
            throw rse;
        } catch (Exception e) {
            log.error("[FAV] /favorites failed", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "favorites_failed");
        }
    }

    /** 기존 규격: /favorites/{recipeId} */
    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavoriteByPath(@PathVariable Long recipeId,
                                         @RequestBody(required = false) Map<String, Object> body,
                                         HttpSession session,
                                         @AuthenticationPrincipal OAuth2User ou,
                                         OAuth2AuthenticationToken authToken) {
        Long uid = requireUserId(session, ou, authToken);
        String title   = body != null ? strOrNull(body.get("title"))   : null;
        String summary = body != null ? strOrNull(body.get("summary")) : null;
        String image   = body != null ? strOrNull(body.get("image"))   : null;
        String meta    = body != null ? strOrNull(body.get("meta"))    : null;

        var f = favoriteService.add(uid, recipeId, title, summary, image, meta);
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(), toIso(f.getCreatedAt()));
    }

    /** 새 규격: body에 recipeId */
    @PostMapping(path = "/favorites", consumes = MediaType.APPLICATION_JSON_VALUE)
    public FavoriteDto addFavoriteByBody(@RequestBody Map<String, Object> body,
                                         HttpSession session,
                                         @AuthenticationPrincipal OAuth2User ou,
                                         OAuth2AuthenticationToken authToken) {
        if (body == null || body.get("recipeId") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId is required");
        }
        Long recipeId = toLong(body.get("recipeId"));
        if (recipeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId must be number");
        }
        Long uid = requireUserId(session, ou, authToken);

        String title   = strOrNull(body.get("title"));
        String summary = strOrNull(body.get("summary"));
        String image   = strOrNull(body.get("image"));
        String meta    = strOrNull(body.get("meta"));

        var f = favoriteService.add(uid, recipeId, title, summary, image, meta);
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(), toIso(f.getCreatedAt()));
    }

    /** 찜 삭제 */
    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<Map<String, Object>> removeFavorite(@PathVariable Long recipeId,
                                                              HttpSession session,
                                                              @AuthenticationPrincipal OAuth2User ou,
                                                              OAuth2AuthenticationToken authToken) {
        var me = requireUser(session, ou, authToken);
        favoriteService.remove(me.getId(), recipeId);
        return ResponseEntity.ok(Map.of("removed", true));
    }
}

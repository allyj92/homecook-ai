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

    private UserAccount requireUser(HttpSession session, OAuth2User ou) {
        // OAuth2 로그인 기반
        if (ou != null) {
            String provider = strOrNull(ou.getAttributes().get("provider"));
            String pid      = strOrNull(ou.getAttributes().get("id"));
            String email    = strOrNull(ou.getAttributes().get("email"));
            String name     = strOrNull(ou.getAttributes().get("name"));
            Long uidAttr    = toLong(ou.getAttributes().get("uid"));

            // 1) provider+id 로 우선 매칭
            if (provider != null && pid != null) {
                var linked = oauthService.findByProvider(provider, pid);
                if (linked.isPresent()) {
                    log.debug("[AUTH] matched by provider+id: {}/{}", provider, pid);
                    return linked.get();
                }
            }

            // 2) email 로 find-or-create
            if (email != null) {
                var ua = userRepo.findByEmailIgnoreCase(email).orElseGet(() -> {
                    UserAccount u = new UserAccount();
                    u.setEmail(email);
                    u.setName(name != null ? name : "User");
                    return userRepo.save(u);
                });
                log.debug("[AUTH] matched by email: {}", email);
                return ua;
            }

            // 3) uid attribute 로 최후 시도 (없거나, findById 실패해도 바로 401 던지지 말고 로그)
            if (uidAttr != null) {
                var byId = userRepo.findById(uidAttr);
                if (byId.isPresent()) {
                    log.debug("[AUTH] matched by uid attribute: {}", uidAttr);
                    return byId.get();
                } else {
                    log.warn("[AUTH] uid attribute {} present but user not found; falling back to 401", uidAttr);
                }
            }

            // 4) 여기까지 못 찾으면 401
            if (provider != null && pid != null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated_no_email");
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 구 세션 방식
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

    /* ======== API ======== */

    /** 즐겨찾기 목록 */
    @GetMapping("/favorites")
    public ResponseEntity<List<FavoriteDto>> favorites(
            HttpSession session,
            @AuthenticationPrincipal OAuth2User ou) {

        log.debug("[FAV] /favorites enter; principal? {}", (ou != null));
        try {
            var me = requireUser(session, ou);
            log.debug("[FAV] /favorites me.id={}", me.getId());

            var rows = favoriteService.list(me.getId()); // Service에서 [FAVORITE] list ... 로그가 찍혀야 정상
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
                                         @AuthenticationPrincipal OAuth2User ou) {
        Long uid = requireUserId(session, ou);
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
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(), toIso(f.getCreatedAt()));
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
}

// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    @SuppressWarnings("unchecked")
    private static Object nested(Map<String,Object> map, String k1, String k2) {
        if (map == null) return null;
        Object a = map.get(k1);
        if (!(a instanceof Map)) return null;
        return ((Map<String,Object>) a).get(k2);
    }

    /** 로컬/소셜 공통으로 현재 사용자 해석 */
    private UserAccount requireUser(Authentication auth, HttpSession session) {
        // 1) OAuth2 로그인 (google/naver/kakao)
        if (auth instanceof OAuth2AuthenticationToken token) {
            String provider = token.getAuthorizedClientRegistrationId(); // "google"/"naver"/"kakao"
            Map<String, Object> a = token.getPrincipal() != null ? token.getPrincipal().getAttributes() : Map.of();
            String pid = strOrNull(a.get("id"));
            if (pid == null) pid = strOrNull(a.get("sub"));
            if (pid == null) pid = strOrNull(nested(a, "response", "id"));

            if (provider != null && pid != null) {
                return oauthService.findByProvider(provider, pid)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 2) 로컬 로그인 (UsernamePasswordAuthenticationToken 등 principal=Map 형태)
        Object p = auth != null ? auth.getPrincipal() : null;
        if (p instanceof Map<?,?> m) {
            Long uid = toLong(m.get("uid"));
            if (uid != null) {
                return userRepo.findById(uid)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated"));
            }
        }

        // 3) 구 세션 fallback (있으면)
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
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
    }

    /* ======== API ======== */

    /** 즐겨찾기 목록 */
    @GetMapping("/favorites")
    public ResponseEntity<List<FavoriteDto>> favorites(
            @RequestParam(required = false) String provider,   // 명시 provider가 필요하면 사용
            HttpSession session,
            Authentication auth
    ) {
        log.debug("[FAV] /favorites enter; auth? {}", (auth != null));
        try {
            var me = requireUser(auth, session);
            log.debug("[FAV] /favorites me.id={} providerParam={}", me.getId(), provider);

            var rows = (provider == null || provider.isBlank())
                    ? favoriteService.list(me.getId())               // 현재 컨텍스트 provider 자동 사용
                    : favoriteService.list(me.getId(), provider);    // 명시적 provider 사용

            var dto = rows.stream()
                    .map(f -> new FavoriteDto(
                            f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                            f.getImage(), f.getMeta(), toIso(f.getCreatedAt())
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
                                         @RequestParam(required = false) String provider,
                                         @RequestBody(required = false) Map<String, Object> body,
                                         HttpSession session,
                                         Authentication auth) {
        var me = requireUser(auth, session);
        String title   = body != null ? strOrNull(body.get("title"))   : null;
        String summary = body != null ? strOrNull(body.get("summary")) : null;
        String image   = body != null ? strOrNull(body.get("image"))   : null;
        String meta    = body != null ? strOrNull(body.get("meta"))    : null;
        String prov    = strOrNull(provider);
        if (prov == null) prov = "community"; // ✅ 기본값

        var f = favoriteService.add(me.getId(), recipeId, title, summary, image, meta);

        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(), toIso(f.getCreatedAt()));
    }

    /** 새 규격: body에 recipeId */
    @PostMapping(path = "/favorites", consumes = MediaType.APPLICATION_JSON_VALUE)
    public FavoriteDto addFavoriteByBody(@RequestBody Map<String, Object> body,
                                         HttpSession session,
                                         Authentication auth) {
        if (body == null || body.get("recipeId") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId is required");
        }
        Long recipeId = toLong(body.get("recipeId"));
        if (recipeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId must be number");
        }
        var me = requireUser(auth, session);

        String title   = strOrNull(body.get("title"));
        String summary = strOrNull(body.get("summary"));
        String image   = strOrNull(body.get("image"));
        String meta    = strOrNull(body.get("meta"));

        var f = favoriteService.add(me.getId(), recipeId, title, summary, image, meta);
        return new FavoriteDto(f.getId(), f.getRecipeId(), f.getTitle(), f.getSummary(),
                f.getImage(), f.getMeta(), toIso(f.getCreatedAt()));
    }

    /** 찜 삭제 */
    @DeleteMapping("/favorites/{recipeId}")
    public ResponseEntity<Map<String, Object>> removeFavorite(@PathVariable Long recipeId,
                                                              HttpSession session,
                                                              Authentication auth) {
        var me = requireUser(auth, session);
        favoriteService.remove(me.getId(), recipeId);
        return ResponseEntity.ok(Map.of("removed", true));
    }
}

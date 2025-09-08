// src/main/java/com/homecook/ai_recipe/controller/MyPageController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.FavoriteDto;
import com.homecook.ai_recipe.service.FavoriteService;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    private final FavoriteService favoriteService;
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /* ========== 내부 유틸 ========== */

    /** SecurityContext에서 OAuth2User 꺼내기 */
    private OAuth2User currentOAuth2User() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof OAuth2User u) return u;
        return null;
    }

    /** 로그인 강제: (1) 옛 세션 로그인 → (2) OAuth2User(email) 순서로 확인 */
    private UserAccount requireUser(HttpSession session) {
        // 1) 예전 방식: 세션 LOGIN_USER
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

        // 2) 새 방식: SecurityContext의 OAuth2User (refresh/bootstrap/naver 등)
        OAuth2User ou = currentOAuth2User();
        if (ou == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");

        String email = (String) ou.getAttributes().get("email"); // refresh에서 심어준 rf_xxx@recipfree.com 또는 네이버 이메일
        String name  = (String) ou.getAttributes().getOrDefault("name", "User");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthenticated");
        }

        // 이메일 기준 조회/생성
        return userRepo.findByEmailIgnoreCase(email).orElseGet(() -> {
            UserAccount ua = new UserAccount();
            ua.setEmail(email);
            ua.setName(name);
            return userRepo.save(ua);
        });
    }

    /** id만 필요한 경로에서 사용 (UserAccount PK 반환) */
    private Long requireUserId(HttpSession session) {
        return requireUser(session).getId();
    }

    /* ========== API ========== */

    /** 즐겨찾기 목록 (프론트는 배열로 사용) */
    @GetMapping("/favorites")
    public ResponseEntity<?> favorites(HttpSession session,
                                       @RequestParam(name = "page", required = false) Integer page,
                                       @RequestParam(name = "size", required = false) Integer size) {
        var me = requireUser(session); // page/size는 무시해도 기존 프론트와 호환됨
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

    /** 찜 추가: 프론트 규격(POST /api/me/favorites/{recipeId})만 유지 */
    @PostMapping("/favorites/{recipeId}")
    public FavoriteDto addFavoriteById(@PathVariable Long recipeId,
                                       @RequestBody(required = false) Map<String, Object> body,
                                       HttpSession session) {

        Long uid = requireUserId(session);

        String title   = body != null ? trimOrNull((String) body.get("title"))   : null;
        String summary = body != null ? trimOrNull((String) body.get("summary")) : null;
        String image   = body != null ? trimOrNull((String) body.get("image"))   : null;
        String meta    = body != null ? trimOrNull((String) body.get("meta"))    : null;

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
    public ResponseEntity<?> removeFavorite(@PathVariable Long recipeId, HttpSession session) {
        var me = requireUser(session);
        favoriteService.remove(me.getId(), recipeId);
        return ResponseEntity.ok(Map.of("removed", true));
    }

    /* ========== helpers ========== */

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}

// src/main/java/com/homecook/ai_recipe/controller/CommunityController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.service.CommunityService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService service;
    private final OAuthAccountService oauthService;

    public CommunityController(CommunityService service, OAuthAccountService oauthService) {
        this.service = service;
        this.oauthService = oauthService;
    }

    /* ---------- helpers ---------- */
    private static String s(Object o) { return o == null ? null : String.valueOf(o).trim(); }

    /** String ID → Long 변환 (Long 범위를 벗어나면 404) */
    private static Long toLongIdOr404(String idStr) {
        if (idStr == null || idStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
        try {
            if (!idStr.matches("^[0-9]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
            }
            BigInteger bi = new BigInteger(idStr);
            BigInteger max = BigInteger.valueOf(Long.MAX_VALUE);
            BigInteger min = BigInteger.ZERO;
            if (bi.compareTo(min) < 0 || bi.compareTo(max) > 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "post not found");
            }
            return bi.longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
    }

    /** 현재 로그인 사용자의 내부 uid(Long) 구하기 — 로컬/소셜 공통 처리 */
    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        // 1) 소셜 로그인(OAuth2)
        if (authentication instanceof OAuth2AuthenticationToken token) {
            String provider = token.getAuthorizedClientRegistrationId();
            OAuth2User principal = token.getPrincipal();
            Map<String, Object> attrs = principal != null ? principal.getAttributes() : Map.of();

            // 우선 attributes['uid']에 내부 uid가 들어온 경우 사용
            Object uidObj = attrs.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String s && !s.isBlank()) {
                try { return Long.parseLong(s); } catch (NumberFormatException ignored) {}
            }

            // 없으면 provider+pid로 DB 조회
            String pid = s(attrs.get("sub"));
            if (pid == null) pid = s(attrs.get("id"));
            if (pid == null) {
                Object resp = attrs.get("response");
                if (resp instanceof Map<?,?> m) pid = s(m.get("id"));
            }
            if (provider == null || pid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

            return oauthService.findByProvider(provider, pid)
                    .map(UserAccount::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        }

        // 2) 로컬 로그인(UsernamePasswordAuthenticationToken 등, principal=Map 형태로 저장해둠)
        Object p = authentication.getPrincipal();
        if (p instanceof Map<?,?> m) {
            Object uidObj = m.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String s && !s.isBlank()) {
                try { return Long.parseLong(s); } catch (NumberFormatException ignored) {}
            }
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    /* ---------- APIs ---------- */

    /** 목록 (카테고리/페이지네이션) - 공개 */
    @GetMapping("/posts")
    public List<PostRes> list(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return service.list(category, page, size);
    }

    /** 단건 조회 - 공개 */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable String id) {
        Long lid = toLongIdOr404(id);
        return service.getOne(lid);
    }

    /** 작성 - 인증 필요 */
    @PostMapping("/posts")
    public Map<String, Long> create(
            @Valid @RequestBody CreatePostReq req,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long id = service.create(userId, req);
        return Map.of("id", id);
    }

    /** 내가 쓴 글 최근 N개 - 인증 필요 */
    @GetMapping("/my-posts")
    public List<PostRes> myPosts(
            @RequestParam(defaultValue = "3") int size,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        return service.findLatestByAuthor(userId, size);
    }

    /** 수정 (작성자 본인만) - 인증 필요 */
    @PutMapping("/posts/{id}")
    public PostRes update(
            @PathVariable String id,
            @Valid @RequestBody CreatePostReq req,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long lid = toLongIdOr404(id);
        service.update(userId, lid, req);
        return service.getOne(lid);
    }
}

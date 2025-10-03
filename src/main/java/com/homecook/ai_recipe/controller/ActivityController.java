package com.homecook.ai_recipe.controller;


import com.homecook.ai_recipe.dto.ActivityCreateReq;
import com.homecook.ai_recipe.dto.ActivityPageRes;
import com.homecook.ai_recipe.service.ActivityService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/activity")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService service;
    private final OAuthAccountService oauthService;

    /* ───── helpers ───── */
    private static String str(Object o) { return o == null ? null : String.valueOf(o).trim(); }
    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static Long asLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignore) {}
        }
        return null;
    }

    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
        }

        if (authentication instanceof OAuth2AuthenticationToken token) {
            OAuth2User principal = token.getPrincipal();
            Map<String, Object> attrs = principal != null ? principal.getAttributes() : Map.of();

            // 1) 로그인 시 attributes에 넣어둔 uid가 있으면 그것을 신뢰
            Long uid = asLong(attrs.get("uid"));
            if (uid != null) return uid;

            // 2) provider + provider 사용자 id로 내부 사용자 찾기
            String provider = token.getAuthorizedClientRegistrationId();
            if (isBlank(provider)) provider = str(attrs.get("provider"));

            String pid = str(attrs.get("sub"));       // Google
            if (isBlank(pid)) pid = str(attrs.get("id")); // Kakao 혹은 일부 공급자
            if (isBlank(pid)) {
                Object resp = attrs.get("response");      // Naver
                if (resp instanceof Map<?, ?> m) pid = str(m.get("id"));
            }

            if (isBlank(provider) || isBlank(pid)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
            }

            return oauthService.findByProvider(provider, pid)
                    .map(u -> u.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized"));
        }

        // 그 외(테스트/커스텀)에서 Map principal 로 uid 제공하는 경우
        Object p = authentication.getPrincipal();
        if (p instanceof Map<?, ?> m) {
            Long uid = asLong(m.get("uid"));
            if (uid != null) return uid;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> add(@RequestBody ActivityCreateReq req, Authentication auth) {
        long uid = resolveUserId(auth);
        service.add(uid, req);
        return Map.of("ok", true);
    }

    @GetMapping
    public ActivityPageRes list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        long uid = resolveUserId(auth);
        int p = Math.max(0, page);
        int s = Math.max(1, Math.min(size, 100)); // 과도한 size 제한
        return service.list(uid, p, s);
    }
}
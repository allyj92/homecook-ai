package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.ActivityCreateReq;
import com.homecook.ai_recipe.dto.ActivityPageRes;
import com.homecook.ai_recipe.service.ActivityService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {
    private final ActivityService service;
    private final OAuthAccountService oauthService;

    public ActivityController(ActivityService service, OAuthAccountService oauthService) {
        this.service = service;
        this.oauthService = oauthService;
    }

    private static String s(Object o) { return o == null ? null : String.valueOf(o).trim(); }

    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        if (authentication instanceof OAuth2AuthenticationToken token) {
            String provider = token.getAuthorizedClientRegistrationId();
            OAuth2User principal = token.getPrincipal();
            var attrs = principal != null ? principal.getAttributes() : Map.of();

            Object uidObj = attrs.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String ss && !ss.isBlank()) {
                try { return Long.parseLong(ss); } catch (NumberFormatException ignored) {}
            }

            String pid = s(attrs.get("sub"));
            if (pid == null) pid = s(attrs.get("id"));
            if (pid == null) {
                Object resp = attrs.get("response");
                if (resp instanceof Map<?,?> m) pid = s(m.get("id"));
            }
            if (provider == null || pid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

            return oauthService.findByProvider(provider, pid)
                    .map(u -> u.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        }

        Object p = authentication.getPrincipal();
        if (p instanceof Map<?,?> m) {
            Object uidObj = m.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String ss && !ss.isBlank()) {
                try { return Long.parseLong(ss); } catch (NumberFormatException ignored) {}
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    @PostMapping
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
        return service.list(uid, page, size);
    }
}
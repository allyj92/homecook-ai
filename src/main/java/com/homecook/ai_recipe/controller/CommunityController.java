// src/main/java/com/homecook/ai_recipe/controller/CommunityController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.service.CommunityService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    /**
     * attributes['uid'](내부 Long ID)가 있으면 그걸 사용.
     * 없으면 provider + pid(sub|id)로 DB의 내부 사용자(UserAccount) 조회해서 Long ID 반환.
     */
    private Long resolveUserId(Number uidMaybe, OAuth2User principal, OAuth2AuthenticationToken token) {
        if (uidMaybe != null) return uidMaybe.longValue();
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        String provider = (token != null)
                ? token.getAuthorizedClientRegistrationId()
                : s(principal.getAttributes().get("provider"));

        String pid = Optional.ofNullable(s(principal.getAttributes().get("sub")))
                .orElse(s(principal.getAttributes().get("id")));

        if (provider == null || pid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        return oauthService.findByProvider(provider, pid)
                .map(UserAccount::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
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
    public PostRes getOne(@PathVariable Long id) {
        return service.getOne(id);
    }

    /** 작성 - 인증 필요 */
    @PostMapping("/posts")
    public Map<String, Long> create(
            @Valid @RequestBody CreatePostReq req,
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid,
            @AuthenticationPrincipal OAuth2User principal,
            OAuth2AuthenticationToken token
    ) {
        long userId = resolveUserId(uid, principal, token);
        Long id = service.create(userId, req);
        return Map.of("id", id);
    }

    /** 내가 쓴 글 최근 N개 - 인증 필요 */
    @GetMapping("/my-posts")
    public List<PostRes> myPosts(
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid,
            @AuthenticationPrincipal OAuth2User principal,
            OAuth2AuthenticationToken token,
            @RequestParam(defaultValue = "3") int size
    ) {
        long userId = resolveUserId(uid, principal, token);
        return service.findLatestByAuthor(userId, size);
    }

    /** 수정 (작성자 본인만) - 인증 필요 */
    @PutMapping("/posts/{id}")
    public PostRes update(
            @PathVariable Long id,
            @Valid @RequestBody CreatePostReq req,
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid,
            @AuthenticationPrincipal OAuth2User principal,
            OAuth2AuthenticationToken token
    ) {
        long userId = resolveUserId(uid, principal, token);
        service.update(userId, id, req);
        return service.getOne(id);
    }
}

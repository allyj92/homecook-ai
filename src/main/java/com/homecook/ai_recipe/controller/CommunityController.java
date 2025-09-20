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

import java.math.BigInteger;
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

    /** String ID → Long 변환 (Long 범위를 벗어나면 404) */
    private static Long toLongIdOr404(String idStr) {
        if (idStr == null || idStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
        try {
            // 숫자만 허용
            if (!idStr.matches("^[0-9]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
            }
            BigInteger bi = new BigInteger(idStr);
            BigInteger max = BigInteger.valueOf(Long.MAX_VALUE);
            BigInteger min = BigInteger.ZERO; // 게시글 ID가 음수일 리 없다는 가정(음수 허용 시 변경)
            if (bi.compareTo(min) < 0 || bi.compareTo(max) > 0) {
                // DB가 bigint(Long)라면 이 범위를 넘는 ID는 존재할 수 없음 → 404
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "post not found");
            }
            return bi.longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
    }

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

    /** 단건 조회 - 공개
     *  String으로 받은 뒤 Long으로 안전 변환해서 서비스에 전달
     */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable String id) {
        Long lid = toLongIdOr404(id);
        return service.getOne(lid);
    }

    /** 작성 - 인증 필요 (서비스 시그니처가 Long 반환이므로 그대로 유지) */
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
            @PathVariable String id,
            @Valid @RequestBody CreatePostReq req,
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid,
            @AuthenticationPrincipal OAuth2User principal,
            OAuth2AuthenticationToken token
    ) {
        long userId = resolveUserId(uid, principal, token);
        Long lid = toLongIdOr404(id);
        service.update(userId, lid, req);
        return service.getOne(lid);
    }
}

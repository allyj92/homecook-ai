package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.service.CommunityService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService service;

    public CommunityController(CommunityService service) {
        this.service = service;
    }

    /** ✅ 커뮤니티 목록 (카테고리/페이지/사이즈) */
    @GetMapping("/posts")
    public List<PostRes> list(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return service.listLatest(category, page, size);
    }

    /** 단건 조회 */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable Long id) {
        return service.getOne(id);
    }

    /** 작성 */
    @PostMapping("/posts")
    public Map<String, Long> create(
            @Valid @RequestBody CreatePostReq req,
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid
    ) {
        if (uid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        long userId = uid.longValue();
        Long id = service.create(userId, req);
        return Map.of("id", id);
    }

    /** 내가 쓴 글 최근 N개 */
    @GetMapping("/my-posts")
    public List<PostRes> myPosts(
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid,
            @RequestParam(defaultValue = "3") int size
    ) {
        if (uid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return service.findLatestByAuthor(uid.longValue(), size);
    }
}
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

    /**
     * 생성: id만 반환
     */

    @GetMapping("/my-posts")
    public List<PostRes> myPosts(
            @AuthenticationPrincipal(expression = "attributes['uid']") Long uid,
            @RequestParam(defaultValue = "3") int size
    ) {
        if (uid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return service.findLatestByAuthor(uid, size); // 서비스에서 최근 size개 조회
    }
    // CommunityController.java
    @PostMapping("/posts")
    public Map<String, Long> create(@Valid @RequestBody CreatePostReq req,
                                    @AuthenticationPrincipal(expression = "id") Long userId) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        Long id = service.create(userId, req);
        return Map.of("id", id);
    }

    /**
     * 단건 조회: 전체 정보를 DTO로 반환
     */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable Long id) {
        return service.getOne(id);
    }

    @GetMapping("/posts/mine")
    public List<PostRes> myPosts(
            @RequestParam(defaultValue = "3") int size,
            @AuthenticationPrincipal(expression = "id") Long userId  // ✅ (A) 커스텀 Principal에 id 필드가 있을 때
    ) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return service.findRecentByAuthor(userId, size);
    }
}



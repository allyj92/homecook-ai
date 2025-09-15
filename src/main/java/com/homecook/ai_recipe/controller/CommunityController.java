// src/main/java/com/homecook/ai_recipe/controller/CommunityController.java
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

    /** ✅ 목록 (카테고리 선택/페이지네이션) */
    @GetMapping("/posts")
    public List<PostRes> list(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return service.list(category, page, size);
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

    // ------------------------------------------------------------
    // ⬇️⬇️⬇️ 추가: 수정 스텁 (프런트 흐름 확인용, DB 저장은 다음 스텝)
    // ------------------------------------------------------------
    /**
     * 수정 (스텁) — 인증만 확인하고 200 OK 반환.
     * 프런트가 PUT /api/community/posts/{id}에 성공 응답만 받으면
     * 상세 페이지로 리다이렉트 흐름이 정상 동작한다.
     *
     * 다음 스텝에서 service.update(userId, id, req) 형태로 실제 저장 로직을 연결하자.
     */
    /** ✅ 수정 (작성자 본인만) */
    @PutMapping("/posts/{id}")
    public PostRes update(
            @PathVariable Long id,
            @Valid @RequestBody CreatePostReq req,
            @AuthenticationPrincipal(expression = "attributes['uid']") Number uid
    ) {
        if (uid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        service.update(uid.longValue(), id, req);
        // ✅ 방금 저장된 최신값을 바로 반환
        return service.getOne(id);
    }
}

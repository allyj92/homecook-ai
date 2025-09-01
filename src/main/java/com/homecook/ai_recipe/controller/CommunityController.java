package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.service.CommunityService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService service;

    public CommunityController(CommunityService service) {
        this.service = service;
    }

    /** 글 생성 */
    @PostMapping("/posts")
    public Map<String, Long> create(@Valid @RequestBody CreatePostReq req
            /*, @AuthenticationPrincipal UserPrincipal me */) {
        // 로그인 아직이면 authorId = null
        Long authorId = null; // me != null ? me.getId() : null;
        Long id = service.create(authorId, req);
        return Map.of("id", id);
    }

    /** 단건 조회 */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable Long id) {
        return service.getOne(id);
    }
}

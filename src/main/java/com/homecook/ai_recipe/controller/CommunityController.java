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

    /**
     * 생성: id만 반환
     */
    @PostMapping("/posts")
    public Map<String, Long> create(@Valid @RequestBody CreatePostReq req) {
        Long id = service.create(null, req); // 로그인 붙이면 authorId 주입
        return Map.of("id", id);
    }

    /**
     * 단건 조회: 전체 정보를 DTO로 반환
     */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable Long id) {
        return service.getOne(id);
    }
}

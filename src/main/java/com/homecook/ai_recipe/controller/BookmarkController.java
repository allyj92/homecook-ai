// src/main/java/com/homecook/ai_recipe/controller/BookmarkController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.service.BookmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/community/bookmarks")
@RequiredArgsConstructor
public class BookmarkController {
    private final BookmarkService svc;

    private Long uidOf(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        // OAuth2 (google/naver/kakao)
        if (authentication instanceof OAuth2AuthenticationToken token) {
            Object v = token.getPrincipal().getAttributes().get("uid");
            if (v != null) return Long.valueOf(String.valueOf(v));
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        // 로컬(세션 principal=Map 형태)
        Object p = authentication.getPrincipal();
        if (p instanceof Map<?,?> m && m.get("uid") != null) {
            return Long.valueOf(String.valueOf(m.get("uid")));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    @PutMapping("/{postId}")
    public ResponseEntity<Void> add(Authentication auth, @PathVariable Long postId) {
        svc.add(uidOf(auth), postId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> remove(Authentication auth, @PathVariable Long postId) {
        svc.remove(uidOf(auth), postId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<Page<CommunityPost>> list(Authentication auth,
                                                    @RequestParam(defaultValue="0") int page,
                                                    @RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok(svc.listPosts(uidOf(auth), page, size));
    }
}

package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.service.BookmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/community/bookmarks")
@RequiredArgsConstructor
public class BookmarkController {
    private final BookmarkService svc;

    private Long uidOf(OAuth2User u) {
        Object v = u.getAttributes().get("uid");
        return Long.valueOf(String.valueOf(v));
    }

    @PutMapping("/{postId}")
    public ResponseEntity<Void> add(@AuthenticationPrincipal OAuth2User me, @PathVariable Long postId) {
        svc.add(uidOf(me), postId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal OAuth2User me, @PathVariable Long postId) {
        svc.remove(uidOf(me), postId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<Page<CommunityPost>> list(@AuthenticationPrincipal OAuth2User me,
                                                    @RequestParam(defaultValue="0") int page,
                                                    @RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok(svc.listPosts(uidOf(me), page, size));
    }
}

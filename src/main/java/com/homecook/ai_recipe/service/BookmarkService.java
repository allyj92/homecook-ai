package com.homecook.ai_recipe.service;


import com.homecook.ai_recipe.domain.CommunityPostBookmark;
import com.homecook.ai_recipe.repo.CommunityPostBookmarkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service @RequiredArgsConstructor
public class BookmarkService {
    private final CommunityPostBookmarkRepository repo;

    public void add(Long uid, Long postId) {
        if (!repo.existsByUserIdAndPostId(uid, postId)) {
            repo.save(CommunityPostBookmark.builder()
                    .userId(uid).postId(postId).createdAt(Instant.now()).build());
        }
    }
    public void remove(Long uid, Long postId) {
        repo.deleteByUserIdAndPostId(uid, postId);
    }
    public Page<?> listPosts(Long uid, int page, int size) {
        return repo.findBookmarkedPosts(uid, PageRequest.of(page, size));
    }
}

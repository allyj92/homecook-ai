// src/main/java/com/homecook/ai_recipe/service/BookmarkService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.repo.CommunityPostBookmarkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class BookmarkService {

    private final CommunityPostBookmarkRepository repo;

    /** 북마크 추가 (중복 무시) */
    public void add(Long uid, Long postId) {
        // native upsert (중복시 NO-OP)
        repo.insertIgnore(postId, uid);
    }

    /** 북마크 제거 */
    public void remove(Long uid, Long postId) {
        repo.deleteByPostIdAndUserId(postId, uid);
    }

    /** 내가 북마크한 글 목록 */
    @Transactional(readOnly = true)
    public Page<CommunityPost> listPosts(Long uid, int page, int size) {
        return repo.findBookmarkedPosts(uid, PageRequest.of(Math.max(0, page), Math.max(1, size)));
    }

    /** 특정 글의 북마크 수 */
    @Transactional(readOnly = true)
    public long countForPost(Long postId) {
        return repo.countByPostId(postId);
    }

    /** 내가 북마크했는지 여부 */
    @Transactional(readOnly = true)
    public boolean isBookmarked(Long uid, Long postId) {
        return repo.existsByPostIdAndUserId(postId, uid);
    }
}

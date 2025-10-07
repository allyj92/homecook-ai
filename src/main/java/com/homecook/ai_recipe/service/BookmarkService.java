// src/main/java/com/homecook/ai_recipe/service/BookmarkService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CommunityPostBookmark;
import com.homecook.ai_recipe.repo.CommunityPostBookmarkRepository;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class BookmarkService {

    private final CommunityPostBookmarkRepository bookmarkRepo;
    private final CommunityPostRepository postRepo;

    public void add(Long uid, Long postId) { bookmarkRepo.insertIgnore(postId, uid); }
    public void remove(Long uid, Long postId) { bookmarkRepo.deleteByPostIdAndUserId(postId, uid); }

    @Transactional(readOnly = true)
    public Page<CommunityPost> listPosts(Long uid, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<CommunityPostBookmark> rows = bookmarkRepo.findByUserIdOrderByCreatedAtDesc(uid, pageable);

        List<Long> ids = rows.getContent().stream().map(CommunityPostBookmark::getPostId).toList();
        if (ids.isEmpty()) return new PageImpl<>(List.of(), pageable, rows.getTotalElements());

        Map<Long, CommunityPost> map = postRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(CommunityPost::getId, Function.identity()));

        List<CommunityPost> ordered = ids.stream()
                .map(map::get).filter(Objects::nonNull).toList();

        return new PageImpl<>(ordered, pageable, rows.getTotalElements());
    }

    @Transactional(readOnly = true)
    public long countForPost(Long postId) { return bookmarkRepo.countByPostId(postId); }

    @Transactional(readOnly = true)
    public boolean isBookmarked(Long uid, Long postId) { return bookmarkRepo.existsByPostIdAndUserId(postId, uid); }
}
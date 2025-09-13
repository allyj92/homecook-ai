package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.repo.CommunityPostRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CommunityService {

    private final CommunityPostRepository repo;

    public CommunityService(CommunityPostRepository repo) {
        this.repo = repo;
    }

    /* ---------------------------
     * YouTube URL → videoId 파싱
     * --------------------------- */
    private static String toYoutubeId(String url) {
        if (url == null) return null;
        String u = url.trim();
        if (u.isEmpty()) return null;
        int i;
        if ((i = u.indexOf("youtu.be/")) >= 0) {
            String id = u.substring(i + "youtu.be/".length());
            int q = id.indexOf('?'); if (q >= 0) id = id.substring(0, q);
            int a = id.indexOf('&'); if (a >= 0) id = id.substring(0, a);
            return id.isBlank() ? null : id;
        }
        if ((i = u.indexOf("watch?v=")) >= 0) {
            String id = u.substring(i + "watch?v=".length());
            int amp = id.indexOf('&'); if (amp >= 0) id = id.substring(0, amp);
            return id.isBlank() ? null : id;
        }
        if ((i = u.indexOf("/shorts/")) >= 0) {
            String id = u.substring(i + "/shorts/".length());
            int q = id.indexOf('?'); if (q >= 0) id = id.substring(0, q);
            int a = id.indexOf('&'); if (a >= 0) id = id.substring(0, a);
            return id.isBlank() ? null : id;
        }
        // 이미 ID만 들어온 경우
        if (u.length() >= 8 && u.length() <= 32 && !u.contains("/") && !u.contains(" ")) return u;
        return null;
    }

    @Transactional
    public Long create(Long authorId, CreatePostReq req) {
        CommunityPost p = new CommunityPost();
        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setAuthorId(authorId);

        // 확장 필드
        p.setYoutubeId(toYoutubeId(req.youtubeUrl()));
        p.setRepImageUrl(req.repImageUrl());

        repo.save(p);
        return p.getId();
    }

    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("post not found: " + id));

        return new PostRes(
                p.getId(),
                p.getTitle(),
                p.getCategory(),
                p.getContent(),
                p.getTags(),
                p.getAuthorId(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getYoutubeId(),
                p.getRepImageUrl()
        );
    }
}

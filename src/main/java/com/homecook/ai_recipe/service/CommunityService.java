package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CommunityService {

    private final CommunityPostRepository repo;

    public CommunityService(CommunityPostRepository repo) {
        this.repo = repo;
    }

    /* 공통 변환 */
    private static PostRes toRes(CommunityPost p) {
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

    /* 커뮤니티 목록: 최신순 (카테고리 선택/페이지네이션) */
    @Transactional(readOnly = true)
    public List<PostRes> listLatest(String category, int page, int size) {
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 50); // 1~50 제한
        var pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return repo.findLatest(category, pr).stream().map(CommunityService::toRes).toList();
    }

    /* 내가 쓴 글 최근 N개 */
    @Transactional(readOnly = true)
    public List<PostRes> findLatestByAuthor(Long authorId, int size) {
        var pr = PageRequest.of(0, Math.max(1, size), Sort.by(Sort.Direction.DESC, "createdAt"));
        return repo.findByAuthorId(authorId, pr).stream().map(CommunityService::toRes).toList();
    }

    @Transactional
    public Long create(Long authorId, CreatePostReq req) {
        CommunityPost p = new CommunityPost();
        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setAuthorId(authorId);

        // 선택 필드
        p.setYoutubeId(toYoutubeId(req.youtubeUrl()));
        p.setRepImageUrl(req.repImageUrl());

        repo.save(p);
        return p.getId();
    }

    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("post not found: " + id));
        return toRes(p);
    }

    /* 유튜브 URL → videoId */
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
        if (u.length() >= 8 && u.length() <= 32 && !u.contains("/") && !u.contains(" ")) return u;
        return null;
    }
}
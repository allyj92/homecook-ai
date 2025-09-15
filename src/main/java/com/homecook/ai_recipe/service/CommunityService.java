// src/main/java/com/homecook/ai_recipe/service/CommunityService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
public class CommunityService {

    private final CommunityPostRepository repo;

    public CommunityService(CommunityPostRepository repo) {
        this.repo = repo;
    }

    /* ---------------- 목록 ---------------- */
    @Transactional(readOnly = true)
    public List<PostRes> list(String category, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<CommunityPost> result = (category == null || category.isBlank())
                ? repo.findAll(pr)
                : repo.findByCategory(category, pr);

        return result.map(p -> new PostRes(
                p.getId(), p.getTitle(), p.getCategory(), p.getContent(),
                p.getTags(), p.getAuthorId(), p.getCreatedAt(), p.getUpdatedAt(),
                p.getYoutubeId(), p.getRepImageUrl()
        )).getContent();
    }

    /* ---------------- 내가 쓴 글 최근 N개 ---------------- */
    @Transactional(readOnly = true)
    public List<PostRes> findLatestByAuthor(Long authorId, int size) {
        var pr = PageRequest.of(0, Math.max(1, size), Sort.by(Sort.Direction.DESC, "createdAt"));
        return repo.findByAuthorId(authorId, pr)
                .map(p -> new PostRes(
                        p.getId(), p.getTitle(), p.getCategory(), p.getContent(),
                        p.getTags(), p.getAuthorId(), p.getCreatedAt(), p.getUpdatedAt(),
                        p.getYoutubeId(), p.getRepImageUrl()
                ))
                .getContent();
    }

    /* ---------------- 작성 ---------------- */
    @Transactional
    public Long create(Long authorId, CreatePostReq req) {
        CommunityPost p = new CommunityPost();
        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setAuthorId(authorId);
        p.setYoutubeId(toYoutubeId(req.youtubeUrl()));
        p.setRepImageUrl(req.repImageUrl());
        // createdAt/updatedAt 은 엔티티의 @CreationTimestamp / @PrePersist / @PreUpdate / Auditing 에 맡김
        repo.save(p);
        return p.getId();
    }

    /* ---------------- 수정 (작성자만) ---------------- */
    @Transactional
    public Long update(Long authorId, Long postId, CreatePostReq req) {
        CommunityPost p = repo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));

        // 작성자 본인만 수정 가능
        if (p.getAuthorId() == null || !Objects.equals(p.getAuthorId(), authorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not_owner");
        }

        // 필드 반영
        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());

        // 유튜브/대표이미지 업데이트(비우면 제거)
        p.setYoutubeId(toYoutubeId(req.youtubeUrl())); // url/ID → ID or null
        p.setRepImageUrl((req.repImageUrl() == null || req.repImageUrl().isBlank()) ? null : req.repImageUrl());

        // updatedAt 역시 엔티티의 @PreUpdate/Auditing이 있으면 자동 반영됨
        repo.save(p);
        return p.getId();
    }

    /* ---------------- 단건 조회 ---------------- */
    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));
        return new PostRes(
                p.getId(), p.getTitle(), p.getCategory(), p.getContent(),
                p.getTags(), p.getAuthorId(), p.getCreatedAt(), p.getUpdatedAt(),
                p.getYoutubeId(), p.getRepImageUrl()
        );
    }

    /* 유튜브 ID 파싱 유틸 */
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

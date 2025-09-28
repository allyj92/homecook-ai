package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    private final CommunityPostRepository repo;
    private final UserAccountRepository userRepo;

    public CommunityService(CommunityPostRepository repo,
                            UserAccountRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    // 마이페이지 - 내가쓴글 - 삭제
    @Transactional
    public void delete(long userId, long postId) {
        var post = repo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));
        if (!Objects.equals(post.getAuthorId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not_author");
        }
        repo.delete(post);
    }

    /* ---------------- 목록 ---------------- */
    @Transactional(readOnly = true)
    public List<PostRes> list(String category, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<CommunityPost> result = (category == null || category.isBlank())
                ? repo.findAll(pr)
                : repo.findByCategory(category, pr);

        var posts = result.getContent();

        // ✅ 작성자 배치 조회(N+1 회피)
        var authorIds = posts.stream()
                .map(CommunityPost::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, UserAccount> userById = userRepo.findAllById(authorIds).stream()
                .collect(Collectors.toMap(UserAccount::getId, u -> u));

        return posts.stream().map(p -> toRes(p, userById.get(p.getAuthorId()))).toList();
    }

    /* ---------------- 내가 쓴 글 최근 N개 ---------------- */
    @Transactional(readOnly = true)
    public List<PostRes> findLatestByAuthor(Long authorId, int size) {
        var pr = PageRequest.of(0, Math.max(1, size), Sort.by(Sort.Direction.DESC, "createdAt"));
        var page = repo.findByAuthorId(authorId, pr);

        // 동일 작성자라 한 번만 조회
        UserAccount u = userRepo.findById(authorId).orElse(null);

        return page.map(p -> toRes(p, u)).getContent();
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
        repo.save(p);
        return p.getId();
    }

    /* ---------------- 수정 (작성자만) ---------------- */
    @Transactional
    public Long update(Long authorId, Long postId, CreatePostReq req) {
        CommunityPost p = repo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));

        if (p.getAuthorId() == null || !Objects.equals(p.getAuthorId(), authorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not_owner");
        }

        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setYoutubeId(toYoutubeId(req.youtubeUrl()));
        p.setRepImageUrl((req.repImageUrl() == null || req.repImageUrl().isBlank()) ? null : req.repImageUrl());

        repo.save(p);
        return p.getId();
    }

    /* ---------------- 단건 조회 ---------------- */
    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));

        UserAccount u = (p.getAuthorId() != null) ? userRepo.findById(p.getAuthorId()).orElse(null) : null;

        return toRes(p, u);
    }

    /* ---- 매핑/유틸 ---- */
    private PostRes toRes(CommunityPost p, UserAccount u) {
        String authorName   = displayName(u, p.getAuthorId());
        String authorAvatar = (u != null && notBlank(u.getAvatar())) ? u.getAvatar() : null;
        String authorHandle = handleOf(u);

        return new PostRes(
                p.getId(),
                p.getTitle(),
                p.getCategory(),
                p.getContent(),
                p.getTags(),
                p.getAuthorId(),
                authorName,
                authorAvatar,
                authorHandle,
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getYoutubeId(),
                p.getRepImageUrl()
        );
    }

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

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String displayName(UserAccount u, Long fallbackId) {
        if (u == null) return "작성자#" + fallbackId;
        String name = notBlank(u.getName()) ? u.getName() : null;
        if (name == null && notBlank(u.getEmail())) {
            name = u.getEmail().split("@")[0];
        }
        return (name == null) ? ("작성자#" + fallbackId) : name;
    }

    private static String handleOf(UserAccount u) {
        if (u == null || !notBlank(u.getEmail())) return null;
        return "@" + u.getEmail().split("@")[0];
    }
}

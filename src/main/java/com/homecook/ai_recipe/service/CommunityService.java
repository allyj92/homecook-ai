// src/main/java/com/homecook/ai_recipe/service/CommunityService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.repo.CommunityCommentRepository;
import com.homecook.ai_recipe.repo.CommunityPostBookmarkRepository;
import com.homecook.ai_recipe.repo.CommunityPostLikeRepository; // ✅ Optional 주입 대비
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    private final CommunityPostRepository postRepo;
    private final CommunityCommentRepository commentRepo;
    private final CommunityPostBookmarkRepository bookmarkRepo;
    private final Optional<CommunityPostLikeRepository> likeRepoOpt; // ✅ 선택 주입
    private final UserAccountRepository userRepo;

    public CommunityService(CommunityPostRepository postRepo,
                            CommunityCommentRepository commentRepo,
                            CommunityPostBookmarkRepository bookmarkRepo,
                            Optional<CommunityPostLikeRepository> likeRepoOpt,
                            UserAccountRepository userRepo) {
        this.postRepo = postRepo;
        this.commentRepo = commentRepo;
        this.bookmarkRepo = bookmarkRepo;
        this.likeRepoOpt = likeRepoOpt == null ? Optional.empty() : likeRepoOpt;
        this.userRepo = userRepo;
    }

    /* ---------------- 목록 ---------------- */

    /**
     * @param sort "new" | "popular"
     */
    @Transactional(readOnly = true)
    public List<PostRes> list(@Nullable String category, int page, int size, String sort) {
        int p = Math.max(0, page);
        int s = Math.max(1, size);

        Pageable pageable = PageRequest.of(p, s, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CommunityPost> result = (category == null || category.isBlank())
                ? postRepo.findAll(pageable)
                : postRepo.findByCategory(category, pageable);

        List<CommunityPost> posts = result.getContent();
        if (posts.isEmpty()) return List.of();

        // 작성자 배치조회
        Map<Long, UserAccount> userById = loadAuthors(posts);

        // 인기 정렬(페이지 내에서만)
        if ("popular".equalsIgnoreCase(sort)) {
            Map<Long, Long> likeCnt = countLikesByPostIds(posts);
            Map<Long, Long> bmCnt   = countBookmarksByPostIds(posts);
            Map<Long, Long> cmtCnt  = countCommentsByPostIds(posts);

            Instant now = Instant.now();
            Comparator<CommunityPost> byHot = Comparator.comparingDouble(pst -> {
                long L = likeCnt.getOrDefault(pst.getId(), 0L);
                long C = cmtCnt.getOrDefault(pst.getId(), 0L);
                long B = bmCnt.getOrDefault(pst.getId(), 0L);
                double engagement = (3 * L) + (2 * C) + (1 * B);
                Instant created = (pst.getCreatedAt() != null)
                        ? pst.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant()
                        : now; // ✅ LocalDateTime → Instant
                double ageHours = Math.max(1.0, Duration.between(created, now).toHours());
                return engagement / Math.pow(ageHours, 0.6);
            });
            posts = new ArrayList<>(posts);
            posts.sort(byHot.reversed());
        }

        // 응답 매핑(+ 집계 숫자 포함)
        Map<Long, Long> likeCnt = countLikesByPostIds(posts);
        Map<Long, Long> bmCnt   = countBookmarksByPostIds(posts);
        Map<Long, Long> cmtCnt  = countCommentsByPostIds(posts);

        List<PostRes> res = new ArrayList<>(posts.size());
        for (CommunityPost p0 : posts) {
            UserAccount u = userById.get(p0.getAuthorId());
            long L = likeCnt.getOrDefault(p0.getId(), 0L);
            long B = bmCnt.getOrDefault(p0.getId(), 0L);
            long C = cmtCnt.getOrDefault(p0.getId(), 0L);
            res.add(toRes(p0, u, L, B, C)); // ✅ like, bookmark, comment 순서 보장
        }
        return res;
    }

    /* ---------------- 내가 쓴 글 최근 N개 ---------------- */
    @Transactional(readOnly = true)
    public List<PostRes> findLatestByAuthor(Long authorId, int size) {
        var pr = PageRequest.of(0, Math.max(1, size), Sort.by(Sort.Direction.DESC, "createdAt"));
        var page = postRepo.findByAuthorId(authorId, pr);

        UserAccount u = userRepo.findById(authorId).orElse(null);

        List<CommunityPost> posts = page.getContent();
        Map<Long, Long> likeCnt = countLikesByPostIds(posts);
        Map<Long, Long> bmCnt   = countBookmarksByPostIds(posts);
        Map<Long, Long> cmtCnt  = countCommentsByPostIds(posts);

        List<PostRes> out = new ArrayList<>(posts.size());
        for (CommunityPost p : posts) {
            out.add(toRes(
                    p, u,
                    likeCnt.getOrDefault(p.getId(), 0L),
                    bmCnt.getOrDefault(p.getId(), 0L),
                    cmtCnt.getOrDefault(p.getId(), 0L)
            ));
        }
        return out;
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
        p.setRepImageUrl(safeUrl(req.repImageUrl()));
        postRepo.save(p);
        return p.getId();
    }

    /* ---------------- 수정 (작성자만) ---------------- */
    @Transactional
    public Long update(Long authorId, Long postId, CreatePostReq req) {
        CommunityPost p = postRepo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));

        if (p.getAuthorId() == null || !Objects.equals(p.getAuthorId(), authorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not_owner");
        }

        p.setTitle((req.title() == null ? "" : req.title()).trim());
        p.setCategory((req.category() == null ? "" : req.category()).trim());
        p.setContent((req.content() == null ? "" : req.content()).trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setYoutubeId(toYoutubeId(req.youtubeUrl()));
        p.setRepImageUrl(safeUrl(req.repImageUrl()));

        postRepo.save(p);
        return p.getId();
    }

    /* ---------------- 단건 조회 ---------------- */
    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = postRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));

        UserAccount u = (p.getAuthorId() != null) ? userRepo.findById(p.getAuthorId()).orElse(null) : null;

        long likeCount = likeRepoOpt.map(r -> r.countByPostId(p.getId())).orElse(0L);
        long bmCount   = bookmarkRepo.countByPostId(p.getId());
        long cmtCount  = commentRepo.countByPost_IdAndDeletedFalse(p.getId());

        return toRes(p, u, likeCount, bmCount, cmtCount);
    }

    /* ---------------- 삭제(마이페이지) ---------------- */
    @Transactional
    public void delete(long userId, long postId) {
        var post = postRepo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found"));
        if (!Objects.equals(post.getAuthorId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not_author");
        }
        postRepo.delete(post);
        // 좋아요/북마크/댓글은 FK cascade 또는 별도 정리 정책 적용
    }

    /* ---------------- 좋아요/북마크 토글 ---------------- */

    /** @return 현재 likeCount */
    @Transactional
    public long setLike(long userId, long postId, boolean on) {
        ensurePostExists(postId);
        var repo = likeRepoOpt.orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "like_not_supported"));
        boolean exists = repo.existsByPostIdAndUserId(postId, userId);
        if (on) {
            if (!exists) repo.insertIgnore(postId, userId); // native upsert(중복 무시)
        } else {
            if (exists) repo.deleteByPostIdAndUserId(postId, userId);
        }
        return repo.countByPostId(postId);
    }

    /** @return 현재 bookmarkCount */
    @Transactional
    public long setBookmark(long userId, long postId, boolean on) {
        ensurePostExists(postId);
        boolean exists = bookmarkRepo.existsByPostIdAndUserId(postId, userId);
        if (on) {
            if (!exists) bookmarkRepo.insertIgnore(postId, userId);
        } else {
            if (exists) bookmarkRepo.deleteByPostIdAndUserId(postId, userId);
        }
        return bookmarkRepo.countByPostId(postId);
    }

    /* ---------------- 내부 유틸 ---------------- */

    private void ensurePostExists(long postId) {
        if (!postRepo.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "post_not_found");
        }
    }

    private Map<Long, UserAccount> loadAuthors(List<CommunityPost> posts) {
        var authorIds = posts.stream()
                .map(CommunityPost::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (authorIds.isEmpty()) return Map.of();
        return userRepo.findAllById(authorIds).stream()
                .collect(Collectors.toMap(UserAccount::getId, u -> u));
    }

    private Map<Long, Long> countLikesByPostIds(List<CommunityPost> posts) {
        if (likeRepoOpt.isEmpty()) {
            Map<Long, Long> zeros = new HashMap<>();
            for (CommunityPost p : posts) zeros.put(p.getId(), 0L);
            return zeros;
        }
        var repo = likeRepoOpt.get();
        Map<Long, Long> map = new HashMap<>();
        for (CommunityPost p : posts) {
            map.put(p.getId(), repo.countByPostId(p.getId()));
        }
        return map;
    }

    private Map<Long, Long> countBookmarksByPostIds(List<CommunityPost> posts) {
        Map<Long, Long> map = new HashMap<>();
        for (CommunityPost p : posts) {
            map.put(p.getId(), bookmarkRepo.countByPostId(p.getId()));
        }
        return map;
    }

    private Map<Long, Long> countCommentsByPostIds(List<CommunityPost> posts) {
        Map<Long, Long> map = new HashMap<>();
        for (CommunityPost p : posts) {
            map.put(p.getId(), commentRepo.countByPost_IdAndDeletedFalse(p.getId()));
        }
        return map;
    }

    private PostRes toRes(CommunityPost p, UserAccount u, long likeCount, long bookmarkCount, long commentCount) {
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
                p.getRepImageUrl(),
                toInt(likeCount),      // ✅ likeCount
                toInt(commentCount),   // ✅ commentCount  ← 순서 주의!
                toInt(bookmarkCount)   // ✅ bookmarkCount ← 순서 주의!    // ✅ 순서: comment
        );
    }

    private static int toInt(long n) {
        return (n < 0) ? 0 : (n > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) n);
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

    private static String safeUrl(String url) {
        if (url == null || url.isBlank()) return null;
        return url.trim();
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

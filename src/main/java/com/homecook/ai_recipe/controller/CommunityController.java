package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.CreatePostReq;
import com.homecook.ai_recipe.domain.PostRes;
import com.homecook.ai_recipe.domain.CommunityComment;
import com.homecook.ai_recipe.domain.CommunityPost;

import com.homecook.ai_recipe.dto.community.CommentCreateReq;
import com.homecook.ai_recipe.dto.community.CommentPageRes;
import com.homecook.ai_recipe.dto.community.CommentRes;
import com.homecook.ai_recipe.dto.community.CommentUpdateReq;
import com.homecook.ai_recipe.repo.CommunityCommentRepository;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.CommunityService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService service;
    private final OAuthAccountService oauthService;

    // ✅ 댓글/포스트/작성자 Repo 직접 주입
    private final CommunityCommentRepository commentRepo;
    private final CommunityPostRepository postRepo;
    private final UserAccountRepository userRepo;

    public CommunityController(CommunityService service,
                               OAuthAccountService oauthService,
                               CommunityCommentRepository commentRepo,
                               CommunityPostRepository postRepo,
                               UserAccountRepository userRepo) {
        this.service = service;
        this.oauthService = oauthService;
        this.commentRepo = commentRepo;
        this.postRepo = postRepo;
        this.userRepo = userRepo;
    }

    /* ---------- helpers ---------- */
    private static String s(Object o) { return o == null ? null : String.valueOf(o).trim(); }

    /** String ID → Long 변환 (Long 범위를 벗어나면 404) */
    private static Long toLongIdOr404(String idStr) {
        if (idStr == null || idStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
        try {
            if (!idStr.matches("^[0-9]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
            }
            BigInteger bi = new BigInteger(idStr);
            BigInteger max = BigInteger.valueOf(Long.MAX_VALUE);
            BigInteger min = BigInteger.ZERO;
            if (bi.compareTo(min) < 0 || bi.compareTo(max) > 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "not found");
            }
            return bi.longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid id");
        }
    }

    private static int clampSize(int size, int min, int max) {
        return Math.max(min, Math.min(max, size));
    }

    /** 현재 로그인 사용자의 내부 uid(Long) 구하기 — 로컬/소셜 공통 처리 */
    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        // 1) 소셜 로그인(OAuth2)
        if (authentication instanceof OAuth2AuthenticationToken token) {
            String provider = token.getAuthorizedClientRegistrationId();
            OAuth2User principal = token.getPrincipal();
            Map<String, Object> attrs = principal != null ? principal.getAttributes() : Map.of();

            Object uidObj = attrs.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String ss && !ss.isBlank()) {
                try { return Long.parseLong(ss); } catch (NumberFormatException ignored) {}
            }

            String pid = s(attrs.get("sub"));
            if (pid == null) pid = s(attrs.get("id"));
            if (pid == null) {
                Object resp = attrs.get("response");
                if (resp instanceof Map<?, ?> m) pid = s(m.get("id"));
            }
            if (provider == null || pid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

            return oauthService.findByProvider(provider, pid)
                    .map(UserAccount::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        }

        // 2) 로컬 로그인(UsernamePasswordAuthenticationToken 등, principal=Map)
        Object p = authentication.getPrincipal();
        if (p instanceof Map<?, ?> m) {
            Object uidObj = m.get("uid");
            if (uidObj instanceof Number n) return n.longValue();
            if (uidObj instanceof String ss && !ss.isBlank()) {
                try { return Long.parseLong(ss); } catch (NumberFormatException ignored) {}
            }
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    /* ---------- Post APIs ---------- */

    /** 목록 (카테고리/페이지네이션) - 공개 */
    @GetMapping("/posts")
    public List<PostRes> list(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return service.list(category, page, size);
    }

    /** 단건 조회 - 공개 */
    @GetMapping("/posts/{id}")
    public PostRes getOne(@PathVariable String id) {
        Long lid = toLongIdOr404(id);
        return service.getOne(lid);
    }

    /** 작성 - 인증 필요 */
    @PostMapping("/posts")
    public Map<String, Long> create(
            @Valid @RequestBody CreatePostReq req,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long id = service.create(userId, req);
        return Map.of("id", id);
    }

    /** 내가 쓴 글 최근 N개 - 인증 필요 */
    @GetMapping("/my-posts")
    public List<PostRes> myPosts(
            @RequestParam(defaultValue = "3") int size,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        return service.findLatestByAuthor(userId, size);
    }

    /** 수정 (작성자 본인만) - 인증 필요 */
    @PutMapping("/posts/{id}")
    public PostRes update(
            @PathVariable String id,
            @Valid @RequestBody CreatePostReq req,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long lid = toLongIdOr404(id);
        service.update(userId, lid, req);
        return service.getOne(lid);
    }

    /** 삭제 - 인증 필요 */
    @DeleteMapping("/posts/{id}")
    public Map<String, Object> delete(
            @PathVariable String id,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long lid = toLongIdOr404(id);
        service.delete(userId, lid);
        return Map.of("deleted", true);
    }

    /** 호환용 POST 삭제 */
    @PostMapping("/posts/{id}/delete")
    public Map<String, Object> deleteCompat(
            @PathVariable String id,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long lid = toLongIdOr404(id);
        service.delete(userId, lid);
        return Map.of("deleted", true);
    }

    /* ---------- Comment APIs (Repo 직접 사용) ---------- */

    /** 댓글 목록(커서 기반) - 공개 */
    @GetMapping("/posts/{id}/comments")
    public CommentPageRes listComments(
            @PathVariable String id,
            @RequestParam(required = false) Long cursor,     // afterId와 동일 의미
            @RequestParam(defaultValue = "20") int size
    ) {
        Long postId = toLongIdOr404(id);
        int limit = clampSize(size, 1, 50);

        List<CommunityComment> rows = commentRepo.findPage(
                postId,
                cursor,                                 // afterId
                PageRequest.of(0, limit)
        );

        // nextCursor 계산(id desc이므로 마지막 원소의 id가 다음 커서)
        Long nextCursor = (rows.size() == limit) ? rows.get(rows.size() - 1).getId() : null;

        List<CommentRes> items = rows.stream().map(CommunityController::toRes).toList();
        long total = commentRepo.countByPost_IdAndDeletedFalse(postId);

        return new CommentPageRes(items, nextCursor, total);
    }

    /** 댓글 작성 - 인증 필요 */
    @PostMapping("/posts/{id}/comments")
    @Transactional
    public CommentRes createComment(
            @PathVariable String id,
            @Valid @RequestBody CommentCreateReq req,
            Authentication authentication
    ) {
        long authorId = resolveUserId(authentication);
        Long postId = toLongIdOr404(id);

        String body = req.content() == null ? "" : req.content().trim();
        if (body.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content required");

        CommunityComment c = new CommunityComment();
        c.setPost(postRepo.getReferenceById(postId));
        c.setAuthor(userRepo.getReferenceById(authorId));
        c.setContent(body);
        c.setDeleted(false);
        c.setCreatedAt(LocalDateTime.now());
        c.setUpdatedAt(LocalDateTime.now());

        if (req.parentId() != null) {
            CommunityComment parent = commentRepo.findById(req.parentId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent not found"));
            if (!parent.getPost().getId().equals(postId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent mismatch");
            }
            c.setParent(parent);
        }

        CommunityComment saved = commentRepo.save(c);
        return toRes(saved);
    }

    /** 댓글 수정(작성자 본인) - 인증 필요 */
    @PutMapping("/posts/{id}/comments/{commentId}")
    @Transactional
    public CommentRes updateComment(
            @PathVariable String id,
            @PathVariable String commentId,
            @Valid @RequestBody CommentUpdateReq req,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long postId = toLongIdOr404(id);
        Long cid = toLongIdOr404(commentId);

        CommunityComment c = commentRepo.findById(cid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!c.getPost().getId().equals(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!c.getAuthor().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (c.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "deleted");
        }

        String body = req.content() == null ? "" : req.content().trim();
        if (body.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content required");

        c.setContent(body);
        c.setUpdatedAt(LocalDateTime.now());
        CommunityComment saved = commentRepo.save(c);
        return toRes(saved);
    }

    /** 댓글 삭제(작성자 본인, 소프트 삭제) - 인증 필요 */
    @DeleteMapping("/posts/{id}/comments/{commentId}")
    @Transactional
    public Map<String, Object> deleteComment(
            @PathVariable String id,
            @PathVariable String commentId,
            Authentication authentication
    ) {
        long userId = resolveUserId(authentication);
        Long postId = toLongIdOr404(id);
        Long cid = toLongIdOr404(commentId);

        CommunityComment c = commentRepo.findById(cid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!c.getPost().getId().equals(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!c.getAuthor().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        c.setDeleted(true);
        c.setContent(null);                 // 목록에서 내용 숨김
        c.setUpdatedAt(LocalDateTime.now());
        commentRepo.save(c);

        return Map.of("deleted", true);
    }

    /* ---------- mappers ---------- */

    private static CommentRes toRes(CommunityComment c) {
        boolean del = c.isDeleted();
        String content = del ? null : c.getContent();
        Long parentId = (c.getParent() != null ? c.getParent().getId() : null);

        return new CommentRes(
                c.getId(),
                c.getPost().getId(),
                c.getAuthor().getId(),
                c.getAuthor().getName(),
                c.getAuthor().getAvatar(),
                content,
                del,
                parentId,
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
        // 필요에 따라 "삭제된 댓글입니다." 같은 문구를 content로 내려주고 싶으면
        // content = del ? "삭제된 댓글입니다." : c.getContent();
    }
}

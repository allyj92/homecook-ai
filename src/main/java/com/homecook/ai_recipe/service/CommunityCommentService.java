package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.CommunityComment;
import com.homecook.ai_recipe.dto.community.CommentPageRes;
import com.homecook.ai_recipe.dto.community.CommentRes;
import com.homecook.ai_recipe.repo.CommunityCommentRepository;
import com.homecook.ai_recipe.repo.CommunityPostRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CommunityCommentService {
    private final CommunityCommentRepository repo;
    private final CommunityPostRepository postRepo;
    private final UserAccountRepository userRepo;

    /* ---------- 공통 유틸 ---------- */
    private static String norm(String s) {
        return s == null ? "" : s.trim();
    }

    /* ========== 생성 ========== */
    @Transactional
    public CommentRes create(Long userId, Long postId, String content, Long parentId) {
        var body = norm(content);
        if (body.isEmpty()) throw new IllegalArgumentException("EMPTY_CONTENT");

        var post = postRepo.getReferenceById(postId);
        var user = userRepo.getReferenceById(userId);

        CommunityComment parent = null;
        if (parentId != null) {
            parent = repo.findById(parentId).orElseThrow(() -> new IllegalArgumentException("PARENT_NOT_FOUND"));
            // 부모가 같은 글에 속하는지 반드시 체크
            if (!Objects.equals(parent.getPost().getId(), postId)) {
                throw new IllegalArgumentException("PARENT_POST_MISMATCH");
            }
        }

        var c = new CommunityComment();
        c.setPost(post);
        c.setAuthor(user);
        c.setContent(body);
        c.setParent(parent);
        repo.save(c);

        return toRes(c);
    }

    /* ========== 조회 ========== */
    @Transactional(readOnly = true)
    public CommentPageRes list(Long postId, Long after, int size) {
        var page = repo.findPage(postId, after, PageRequest.of(0, size)); // 레포에서 deleted=false 조건 포함
        Long next = page.size() == size ? page.get(page.size() - 1).getId() : null;
        long total = repo.countByPost_IdAndDeletedFalse(postId);
        return new CommentPageRes(page.stream().map(this::toRes).toList(), next, total);
    }

    /* ========== 수정 ========== */
    @Transactional
    public CommentRes update(Long userId, Long postId, Long id, String content, boolean isAdmin) {
        var c = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("COMMENT_NOT_FOUND"));

        // postId 검증(무결성)
        if (!Objects.equals(c.getPost().getId(), postId)) {
            throw new IllegalArgumentException("POST_MISMATCH");
        }
        // 삭제된 댓글은 수정 금지
        if (c.isDeleted()) throw new IllegalStateException("ALREADY_DELETED");

        // 권한: 작성자 or 관리자
        if (!Objects.equals(c.getAuthor().getId(), userId) && !isAdmin) {
            throw new AccessDeniedException("NOT_AUTHOR");
        }

        var body = norm(content);
        if (body.isEmpty()) throw new IllegalArgumentException("EMPTY_CONTENT");

        c.setContent(body);
        c.setUpdatedAt(LocalDateTime.now());
        return toRes(c);
    }

    /* ========== 삭제(소프트) ========== */
    @Transactional
    public void delete(Long userId, Long postId, Long id, boolean isAdmin) {
        var c = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("COMMENT_NOT_FOUND"));

        // postId 검증
        if (!Objects.equals(c.getPost().getId(), postId)) {
            throw new IllegalArgumentException("POST_MISMATCH");
        }

        // 권한: 작성자 or 관리자
        if (!Objects.equals(c.getAuthor().getId(), userId) && !isAdmin) {
            throw new AccessDeniedException("NOT_AUTHOR");
        }

        if (!c.isDeleted()) {
            c.setDeleted(true);
            c.setContent(""); // 클라에서 "삭제된 댓글입니다."로 렌더
            c.setUpdatedAt(LocalDateTime.now());
        }
    }

    /* ---------- DTO 변환 ---------- */
    private CommentRes toRes(CommunityComment c) {
        var u = c.getAuthor();
        return new CommentRes(
                c.getId(),
                c.getPost().getId(),
                u.getId(),
                u.getName(),
                u.getAvatar(),
                c.isDeleted() ? "" : c.getContent(),
                c.isDeleted(),
                c.getParent() != null ? c.getParent().getId() : null,
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}

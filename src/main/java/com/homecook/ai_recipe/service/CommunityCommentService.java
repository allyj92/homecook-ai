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

    @Transactional
    public CommentRes create(Long userId, Long postId, String content, Long parentId) {
        var post = postRepo.getReferenceById(postId);
        var user = userRepo.getReferenceById(userId);
        CommunityComment c = new CommunityComment();
        c.setPost(post);
        c.setAuthor(user);
        c.setContent(content.trim());
        if (parentId != null) c.setParent(repo.getReferenceById(parentId));
        repo.save(c);
        return toRes(c);
    }

    @Transactional(readOnly=true)
    public CommentPageRes list(Long postId, Long after, int size) {
        var page = repo.findPage(postId, after, PageRequest.of(0, size));
        Long next = page.size() == size ? page.get(page.size()-1).getId() : null;
        long total = repo.countByPost_IdAndDeletedFalse(postId);
        return new CommentPageRes(page.stream().map(this::toRes).toList(), next, total);
    }

    @Transactional
    public CommentRes update(Long userId, Long id, String content) {
        var c = repo.findById(id).orElseThrow();
        if (!Objects.equals(c.getAuthor().getId(), userId)) throw new AccessDeniedException("not author");
        c.setContent(content.trim());
        c.setUpdatedAt(LocalDateTime.now());
        return toRes(c);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        var c = repo.findById(id).orElseThrow();
        if (!Objects.equals(c.getAuthor().getId(), userId)) throw new AccessDeniedException("not author");
        c.setDeleted(true);
        c.setContent(""); // 표시만 "삭제된 댓글입니다."로 처리
        c.setUpdatedAt(LocalDateTime.now());
    }

    private CommentRes toRes(CommunityComment c) {
        var u = c.getAuthor();
        return new CommentRes(
                c.getId(), c.getPost().getId(),
                u.getId(), u.getName(), u.getAvatar(),
                c.isDeleted() ? "" : c.getContent(),
                c.isDeleted(),
                c.getParent() != null ? c.getParent().getId() : null,
                c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}

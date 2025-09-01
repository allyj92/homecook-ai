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

    @Transactional
    public Long create(Long authorId, CreatePostReq req) {
        CommunityPost p = new CommunityPost();
        p.setTitle(req.title().trim());
        p.setCategory(req.category().trim());
        p.setContent(req.content().trim());
        p.setTags(req.tags() == null ? List.of() : req.tags());
        p.setAuthorId(authorId);
        repo.save(p);
        return p.getId();
    }

    @Transactional(readOnly = true)
    public PostRes getOne(Long id) {
        CommunityPost p = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("post not found: " + id));
        return new PostRes(
                p.getId(), p.getTitle(), p.getCategory(), p.getContent(),
                p.getTags(), p.getAuthorId(), p.getCreatedAt(), p.getUpdatedAt()
        );
    }
}
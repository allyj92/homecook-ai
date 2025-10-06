package com.homecook.ai_recipe.service;


import com.homecook.ai_recipe.dto.RecipeRes;
import com.homecook.ai_recipe.repo.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RecipeReadService {
    private final RecipeRepository repo;

    public List<RecipeRes> list(int page, int size, Sort sort) {
        return repo.findAll(PageRequest.of(page, size, sort))
                .map(RecipeRes::from)
                .getContent(); // 프런트가 배열을 기대하므로 content만 반환
    }

    public List<RecipeRes> latest(int size) {
        return list(0, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public RecipeRes getOne(Long id) {
        return repo.findById(id)
                .map(RecipeRes::from)
                .orElseThrow(() -> new IllegalArgumentException("recipe_not_found"));
    }
}
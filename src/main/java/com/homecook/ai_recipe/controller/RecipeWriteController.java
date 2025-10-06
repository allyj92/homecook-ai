package com.homecook.ai_recipe.controller;
import com.homecook.ai_recipe.dto.RecipeCardDto;
import com.homecook.ai_recipe.domain.Recipe;
import com.homecook.ai_recipe.dto.RecipeCreateReq;
import com.homecook.ai_recipe.repo.RecipeRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recipes")
public class RecipeWriteController {

    private final RecipeRepository recipeRepo;

    @PostMapping
    @Transactional
    public RecipeCardDto create(@RequestBody @Valid RecipeCreateReq req) {
        Recipe r = new Recipe();
        r.setTitle(req.getTitle());
        r.setSummary(req.getSummary());
        r.setKcal(req.getKcal());
        r.setCarbsG(req.getCarbsG());
        r.setProteinG(req.getProteinG());
        r.setFatG(req.getFatG());
        r.setSodiumMg(req.getSodiumMg());
        r.setCookTimeMin(req.getCookTimeMin());
        r.setTips(req.getTips());
        // 엔티티에 있으면 사용:
        // r.setRepImageUrl(req.getRepImageUrl());

        if (r.getCreatedAt() == null) r.setCreatedAt(Instant.now());

        Recipe saved = recipeRepo.save(r);
        return new RecipeCardDto(
                saved.getId(),
                saved.getTitle(),
                saved.getCreatedAt(),
                0, 0,
                null // saved.getRepImageUrl() 사용 가능하면 교체
        );
    }
}
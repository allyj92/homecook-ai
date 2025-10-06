package com.homecook.ai_recipe.controller;

;
import com.homecook.ai_recipe.dto.RecipeRes;
import com.homecook.ai_recipe.service.RecipeReadService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeReadController {
    private final RecipeReadService svc;

    // 프런트: /api/recipes?page=0&size=8&sort=createdAt,desc
    @GetMapping
    public List<RecipeRes> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        String[] parts = sort.split(",", 2);
        String prop = parts[0];
        Sort.Direction dir = (parts.length > 1 && "asc".equalsIgnoreCase(parts[1]))
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return svc.list(page, size, Sort.by(dir, prop));
    }

    // 프런트 폴백: /api/recipes/latest?size=8
    @GetMapping("/latest")
    public List<RecipeRes> latest(@RequestParam(defaultValue = "8") int size) {
        return svc.latest(size);
    }

    // 상세 대비
    @GetMapping("/{id}")
    public RecipeRes getOne(@PathVariable Long id) {
        return svc.getOne(id);
    }
}

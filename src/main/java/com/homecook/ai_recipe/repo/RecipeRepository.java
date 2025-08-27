package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    List<Recipe> findTop10ByOrderByCreatedAtDesc();
    List<Recipe> findByTitleContainingIgnoreCase(String q);

}
package com.homecook.ai_recipe.repo;
import com.homecook.ai_recipe.domain.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {}
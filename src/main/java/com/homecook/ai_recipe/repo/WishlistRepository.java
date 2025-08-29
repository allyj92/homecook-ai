// src/main/java/com/homecook/ai_recipe/repo/WishlistRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.wishlist.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WishlistRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserOrderByCreatedAtDesc(UserAccount user);
}

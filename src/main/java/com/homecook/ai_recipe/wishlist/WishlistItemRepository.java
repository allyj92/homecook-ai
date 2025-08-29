// src/main/java/com/homecook/ai_recipe/wishlist/WishlistItemRepository.java
package com.homecook.ai_recipe.wishlist;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserOrderByCreatedAtDesc(UserAccount user);
    Optional<WishlistItem> findByUserAndItemKey(UserAccount user, String itemKey);
    boolean existsByUserAndItemKey(UserAccount user, String itemKey);
    long deleteByUserAndItemKey(UserAccount user, String itemKey);
}

// src/main/java/com/homecook/ai_recipe/domain/UserAccount.java
package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_account", indexes = {
        @Index(name = "idx_user_email", columnList = "email", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)   // 이메일 유니크
    private String email;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false; // 기본값 false

    @Column(nullable = true)
    private String passwordHash;
    @Column(nullable = false)
    private String name;

    private String avatar;


    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** 엔티티 처음 저장될 때 실행 */
    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** 엔티티 수정될 때 실행 */
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

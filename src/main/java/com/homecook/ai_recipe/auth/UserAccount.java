// src/main/java/com/homecook/ai_recipe/domain/UserAccount.java
package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_account")

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="email")  // 이메일 유니크
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

    /* ✅ 추가한 스트릭 관련 필드 */
    @Column(name = "streak_days", nullable = false)
    private int streakDays = 0; // 연속 활동일 수

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate; // 마지막 활동 날짜 (KST 기준)

    /** 엔티티 수정될 때 실행 */
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

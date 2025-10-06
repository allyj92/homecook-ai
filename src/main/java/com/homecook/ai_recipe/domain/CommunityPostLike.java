package com.homecook.ai_recipe.domain;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "community_post_like",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"post_id", "user_id"})},
        indexes = {
                @Index(name = "ix_cpl_post", columnList = "post_id"),
                @Index(name = "ix_cpl_user", columnList = "user_id")
        }
)
public class CommunityPostLike {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "post_id", nullable = false)
    private CommunityPost post;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // getters/setters
    public Long getId() { return id; }
    public CommunityPost getPost() { return post; }
    public void setPost(CommunityPost post) { this.post = post; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}